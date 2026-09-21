# Revisión de una parte del manual: la abre en un navegador sin ventana, espera a que paginar.js arme las hojas,
# informa avisos de la consola (por ejemplo, un elemento más alto que una hoja) e imágenes que no cargaron,
# guarda cada hoja como imagen y arma una hoja de contactos con todas.
#
# Uso, con el servidor local de la app en marcha (puerto 9100):
#   powershell -ExecutionPolicy Bypass -File herramientas\revisar-hojas.ps1 -Navegador 'C:\ruta\al\navegador.exe' `
#     -Parte es/01-introduccion.html -Salida C:\Temp\hojas
# Las imágenes (hoja-01.png…) y contactos.png quedan en -Salida, que se vacía de imágenes antes de empezar.
param(
  [Parameter(Mandatory = $true)][string]$Navegador,
  [Parameter(Mandatory = $true)][string]$Parte,
  [Parameter(Mandatory = $true)][string]$Salida,
  [double]$Escala = 1.5,
  [int]$PorFila = 5,
  [int]$Puerto = 9346
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$perfil = Join-Path $env:TEMP ('scimetricspro-hojas-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $Salida | Out-Null
Get-ChildItem $Salida -Filter '*.png' | ForEach-Object { [IO.File]::Delete($_.FullName) }
$url = "http://localhost:9100/manual/$Parte"
$proc = Start-Process -FilePath $Navegador -PassThru -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  "--remote-debugging-port=$Puerto", "--user-data-dir=$perfil", 'about:blank')

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

try {
  $destino = $null
  for ($i = 0; $i -lt 50 -and -not $destino; $i++) {
    Start-Sleep -Milliseconds 200
    try { $destino = (Invoke-RestMethod "http://127.0.0.1:$Puerto/json/list") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch {}
  }
  $ws = New-Object Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$destino.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  [void](Invoke-Cdp $ws 'Emulation.setDeviceMetricsOverride' @{ width = 1000; height = 1200; deviceScaleFactor = 1; mobile = $false })
  [void](Invoke-Cdp $ws 'Page.enable' @{})
  $espia = "window.__avisos=[];(function(){var w=console.warn,e=console.error;" +
    "console.warn=function(){window.__avisos.push('aviso: '+[].map.call(arguments,function(a){return a&&a.outerHTML?a.outerHTML.slice(0,160):String(a)}).join(' '));return w.apply(console,arguments)};" +
    "console.error=function(){window.__avisos.push('error: '+[].join.call(arguments,' '));return e.apply(console,arguments)};" +
    "window.addEventListener('error',function(ev){window.__avisos.push('error: '+ev.message+' '+(ev.target&&ev.target.src||''))},true)})();"
  [void](Invoke-Cdp $ws 'Page.addScriptToEvaluateOnNewDocument' @{ source = $espia })
  [void](Invoke-Cdp $ws 'Page.navigate' @{ url = $url })
  $listo = $false
  $fin = (Get-Date).AddSeconds(90)
  while (-not $listo -and (Get-Date) -lt $fin) {
    Start-Sleep -Milliseconds 500
    $r = Invoke-Cdp $ws 'Runtime.evaluate' @{ expression = "document.documentElement.classList.contains('paginado')"; returnByValue = $true }
    $listo = [bool]$r.result.result.value
  }
  Start-Sleep -Milliseconds 800
  $expr = "JSON.stringify({avisos: window.__avisos, hojas: [...document.querySelectorAll('.hoja')].map(h => { const b = h.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height]; }), rotas: [...document.images].filter(i => !i.naturalWidth).map(i => i.src)})"
  $info = (Invoke-Cdp $ws 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true }).result.result.value | ConvertFrom-Json
  "paginado: $listo, hojas: " + $info.hojas.Count
  if ($info.avisos.Count) { 'avisos de la consola:'; $info.avisos | ForEach-Object { '  ' + $_ } }
  if ($info.rotas.Count) { 'imágenes que no cargaron:'; $info.rotas | ForEach-Object { '  ' + $_ } }
  $n = 0
  foreach ($h in $info.hojas) {
    $n++
    $foto = Invoke-Cdp $ws 'Page.captureScreenshot' @{ format = 'png'; captureBeyondViewport = $true; clip = @{ x = $h[0]; y = $h[1]; width = $h[2]; height = $h[3]; scale = $Escala } }
    [IO.File]::WriteAllBytes((Join-Path $Salida ('hoja-{0:D2}.png' -f $n)), [Convert]::FromBase64String($foto.result.data))
  }
  # by number, so that hoja-100 comes after hoja-99
  $archivos = Get-ChildItem $Salida -Filter 'hoja-*.png' | Sort-Object { [int]($_.BaseName -replace '\D', '') }
  $an = 300; $al = 388; $sep = 12
  $filas = [math]::Ceiling($archivos.Count / $PorFila)
  $lamina = New-Object Drawing.Bitmap ($PorFila * ($an + $sep) + $sep), ($filas * ($al + $sep + 18) + $sep)
  $g = [Drawing.Graphics]::FromImage($lamina)
  $g.Clear([Drawing.Color]::FromArgb(125, 133, 148))
  $g.InterpolationMode = 'HighQualityBicubic'
  $letra = New-Object Drawing.Font 'Segoe UI', 9
  for ($i = 0; $i -lt $archivos.Count; $i++) {
    $img = [Drawing.Image]::FromFile($archivos[$i].FullName)
    $x = $sep + ($i % $PorFila) * ($an + $sep)
    $y = $sep + [math]::Floor($i / $PorFila) * ($al + $sep + 18)
    $g.DrawImage($img, $x, $y + 16, $an, $al)
    $g.DrawString(('hoja ' + ($i + 1)), $letra, [Drawing.Brushes]::White, $x, $y)
    $img.Dispose()
  }
  $g.Dispose()
  $lamina.Save((Join-Path $Salida 'contactos.png'), [Drawing.Imaging.ImageFormat]::Png)
  $lamina.Dispose()
  'hoja de contactos: ' + (Join-Path $Salida 'contactos.png')
} finally {
  try { $proc | Stop-Process -Force } catch {}
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like ('*' + $perfil + '*') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  # remove the throwaway profile (~30 MB each run); the browser may hold its files for a moment after closing
  for ($k = 0; $k -lt 20 -and (Test-Path -LiteralPath $perfil); $k++) {
    try { Remove-Item -LiteralPath $perfil -Recurse -Force -ErrorAction Stop } catch { Start-Sleep -Milliseconds 250 }
  }
}
