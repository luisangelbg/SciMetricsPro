# Captura de pantalla para el manual: abre herramientas/captura.html con una receta de pasos en un navegador
# sin ventana, espera en tiempo real a que la receta termine (título «ready»; así terminan también los cálculos
# que corren en segundo plano, como las redes) y guarda la imagen a doble resolución.
#
# Uso, con el servidor local de la app en marcha (puerto 9100):
#   powershell -ExecutionPolicy Bypass -File herramientas\capturar.ps1 -Navegador 'C:\ruta\al\navegador.exe' `
#     -Nombre app-fuentes -Receta 'ex;go:sources;tab:stab-bradford' -Alto 1100 `
#     -Recorte '560,400,2200,1500' -Marcas '#srcCards|#stab-bradford'
# La imagen queda en img\<Nombre>.png. Los pasos de la receta están descritos en captura.html.
# -Recorte x,y,ancho,alto   recorta la imagen (en píxeles de la imagen, que mide el doble de la ventana).
# -Marcas sel1|sel2…        selectores de los elementos que llevarán marca numerada: para cada uno se escribe su caja
#                           en píxeles de la imagen sin recortar (útil para calcular -Recorte) y tres posiciones listas
#                           para copiar (a la derecha, a la izquierda y encima de su texto), en porcentajes de la imagen
#                           final, con el formato de style="left:…;top:…" de interior.css.
param(
  [Parameter(Mandatory = $true)][string]$Navegador,
  [Parameter(Mandatory = $true)][string]$Nombre,
  [string]$Receta = '',
  [int]$Ancho = 1400,
  [int]$Alto = 900,
  [string]$Tema = 'light',
  [string]$Idioma = 'es',
  [switch]$Avisos,
  [switch]$Barras,
  [string]$Recorte = '',
  [string]$Marcas = '',
  [string]$Salida = '',
  [int]$Puerto = 9345,
  [int]$Segundos = 240
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (-not $Salida) { $Salida = Join-Path (Split-Path (Split-Path $MyInvocation.MyCommand.Definition -Parent) -Parent) 'img' }
$perfil = Join-Path $env:TEMP ('scimetricspro-manual-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$url = "http://localhost:9100/manual/herramientas/captura.html?w=$Ancho&h=$Alto&theme=$Tema&lang=$Idioma" + $(if ($Avisos) { '&toasts=1' } else { '' }) +
  $(if ($Marcas) { '&marcas=' + [Uri]::EscapeDataString($Marcas) } else { '' }) + "&do=$Receta"
$argumentos = @('--headless=new', '--disable-gpu', '--no-first-run')
if (-not $Barras) { $argumentos += '--hide-scrollbars' }   # -Barras: deja ver las barras de desplazamiento de las listas que se recorren
$proc = Start-Process -FilePath $Navegador -PassThru -ArgumentList ($argumentos +
  @("--remote-debugging-port=$Puerto", "--user-data-dir=$perfil", 'about:blank'))

$script:siguiente = 0
function Invoke-Cdp($ws, [string]$metodo, $parametros) {
  $script:siguiente++
  $id = $script:siguiente
  $msg = @{ id = $id; method = $metodo; params = $parametros } | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $ws.SendAsync((New-Object ArraySegment[byte] -ArgumentList (, $bytes)), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  $buf = New-Object byte[] 8388608
  while ($true) {
    $ms = New-Object IO.MemoryStream
    do {
      $r = $ws.ReceiveAsync((New-Object ArraySegment[byte] -ArgumentList (, $buf)), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $ms.Write($buf, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $m = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
    if ($m.id -eq $id) { return $m }
  }
}
function Pct([double]$v) { $v = [math]::Min(0.98, [math]::Max(0.02, $v)); ([math]::Round($v * 1000) / 10).ToString([Globalization.CultureInfo]::InvariantCulture) + '%' }

try {
  $destino = $null
  for ($i = 0; $i -lt 50 -and -not $destino; $i++) {
    Start-Sleep -Milliseconds 200
    try { $destino = (Invoke-RestMethod "http://127.0.0.1:$Puerto/json/list") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch {}
  }
  $ws = New-Object Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$destino.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  [void](Invoke-Cdp $ws 'Emulation.setDeviceMetricsOverride' @{ width = $Ancho; height = $Alto; deviceScaleFactor = 2; mobile = $false })
  [void](Invoke-Cdp $ws 'Page.enable' @{})
  [void](Invoke-Cdp $ws 'Page.navigate' @{ url = $url })
  $lista = $false
  $fin = (Get-Date).AddSeconds($Segundos)
  while (-not $lista -and (Get-Date) -lt $fin) {
    Start-Sleep -Milliseconds 400
    $r = Invoke-Cdp $ws 'Runtime.evaluate' @{ expression = 'document.title'; returnByValue = $true }
    $lista = ($r.result.result.value -eq 'ready')
  }
  Start-Sleep -Milliseconds 400
  $foto = Invoke-Cdp $ws 'Page.captureScreenshot' @{ format = 'png' }
  New-Item -ItemType Directory -Force $Salida | Out-Null
  $archivo = Join-Path $Salida ($Nombre + '.png')
  $bytes = [Convert]::FromBase64String($foto.result.data)
  # crop box in image pixels (the image is twice the window)
  $cx = 0; $cy = 0; $cw = $Ancho * 2; $ch = $Alto * 2
  if ($Recorte) {
    $v = $Recorte.Split(',') | ForEach-Object { [int]$_ }
    $cx = $v[0]; $cy = $v[1]; $cw = $v[2]; $ch = $v[3]
    $ms = New-Object IO.MemoryStream (, $bytes)
    $img = [Drawing.Image]::FromStream($ms)
    $bmp = New-Object Drawing.Bitmap $cw, $ch
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, (New-Object Drawing.Rectangle 0, 0, $cw, $ch), (New-Object Drawing.Rectangle $cx, $cy, $cw, $ch), [Drawing.GraphicsUnit]::Pixel)
    $g.Dispose(); $img.Dispose()
    $bmp.Save($archivo, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  } else {
    [IO.File]::WriteAllBytes($archivo, $bytes)
  }
  if ($lista) { "lista: $Nombre.png ($cw x $ch)" } else { "la receta no terminó en $Segundos s; se capturó igual: $Nombre.png" }
  if ($Marcas) {
    $cajas = (Invoke-Cdp $ws 'Runtime.evaluate' @{ expression = 'JSON.stringify(window.__rects || [])'; returnByValue = $true }).result.result.value | ConvertFrom-Json
    $sels = $Marcas.Split('|')
    for ($k = 0; $k -lt $sels.Count; $k++) {
      $c = $cajas[$k]
      if (-not $c) { ('{0,2}. {1}: no se encontró' -f ($k + 1), $sels[$k]); continue }
      $x0 = $c[0] * 2 - $cx; $y0 = $c[1] * 2 - $cy; $x1 = $x0 + $c[2] * 2; $y1 = $y0 + $c[3] * 2; $ym = ($y0 + $y1) / 2
      $der = 'left:' + (Pct (($x1 + 56) / $cw)) + ';top:' + (Pct ($ym / $ch))
      $izq = 'left:' + (Pct (($x0 - 56) / $cw)) + ';top:' + (Pct ($ym / $ch))
      $arr = 'left:' + (Pct ((($x0 + $x1) / 2) / $cw)) + ';top:' + (Pct (($y0 - 50) / $ch))
      $fuera = if ($x1 -lt 0 -or $y1 -lt 0 -or $x0 -gt $cw -or $y0 -gt $ch) { '  (fuera del recorte)' } else { '' }
      ('{0,2}. {1}{2}' -f ($k + 1), $sels[$k], $fuera)
      ('    caja {0},{1},{2},{3}' -f [int]($c[0] * 2), [int]($c[1] * 2), [int]($c[2] * 2), [int]($c[3] * 2))
      ('    derecha {0} · izquierda {1} · encima {2}' -f $der, $izq, $arr)
    }
  }
} finally {
  try { $proc | Stop-Process -Force } catch {}
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like ('*' + $perfil + '*') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  # remove the throwaway profile (~30 MB each run); the browser may hold its files for a moment after closing
  for ($k = 0; $k -lt 20 -and (Test-Path -LiteralPath $perfil); $k++) {
    try { Remove-Item -LiteralPath $perfil -Recurse -Force -ErrorAction Stop } catch { Start-Sleep -Milliseconds 250 }
  }
}
