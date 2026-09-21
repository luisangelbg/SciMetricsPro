#!/usr/bin/perl
# SciMetricsPro · manual de usuario: rehace el índice general de 01-introduccion.html con los títulos reales.
# Uso, desde la carpeta manual/:   perl herramientas/indice-general.pl es
# Lee el <h1> y los <h2 id="…"><span class="num">…</span>…</h2> de cada parte y reescribe, para cada capítulo del
# índice, su título y la lista de sus secciones. El capítulo 1 y los apéndices conservan el título del índice.
# Correrlo cada vez que se agregue, quite o renombre una sección; los números de página los pone paginar.js.
use strict; use warnings; use utf8;
use open qw(:std :encoding(UTF-8));

my $lang = shift or die "uso: perl herramientas/indice-general.pl <carpeta del idioma>\n";
local $/;
my %parts;
opendir my $dh, $lang or die "$lang: $!";
for my $f (sort grep { /^(0[1-9]|1\d)-.*\.html$/ && $_ ne 'manual-completo.html' } readdir $dh) {
  open my $h, '<', "$lang/$f" or die "$f: $!"; my $s = <$h>; close $h;
  while ($s =~ m{<section class="capitulo[^"]*" id="([^"]+)"(.*?)</section>}sg) {
    my ($id, $body) = ($1, $2);
    my ($h1) = $body =~ m{<h1[^>]*>(.*?)</h1>}s;
    my @h2;
    while ($body =~ m{<h2 id="([^"]+)"[^>]*><span class="num">([^<]+)</span>(.*?)</h2>}sg) {
      my ($hid, $num, $t) = ($1, $2, $3); $t =~ s{<[^>]+>}{}g; $t =~ s/\s+/ /g; $t =~ s/^\s+|\s+$//g;
      push @h2, [$num, $hid, $t];
    }
    $parts{$id} = { h1 => $h1 // '', h2 => \@h2 };
  }
}
closedir $dh;
my $file = "$lang/01-introduccion.html";
open my $h, '<', $file or die "$file: $!"; my $s = <$h>; close $h;
my ($toc) = $s =~ m{(<ol class="toc">.*?</ol>)}s or die "no encuentro el índice en $file\n";
my ($new, $n) = ($toc, 0);
$new =~ s{(<div class="toc-cap"><span class="chip [a-z0-9]+">[^<]+</span><a href="#([^"]+)">)([^<]*)(</a><a class="pag" href="#[^"]+"></a></div>)(\s*<ul>.*?</ul>)?}{
  my ($pre, $id, $title, $post, $ul) = ($1, $2, $3, $4, $5);
  my $p = $parts{$id};
  if (!$p || !@{ $p->{h2} }) { $pre . $title . $post . ($ul // '') }
  else {
    (my $t = $p->{h1}) =~ s{<[^>]+>}{}g;
    $t = $title if $id eq 'cap-intro' || $id eq 'apendices';
    $n++;
    $pre . $t . $post . "\n      <ul>\n" . join('', map { qq{        <li><span class="n">$_->[0]</span><a href="#$_->[1]"><span class="t">$_->[2]</span></a></li>\n} } @{ $p->{h2} }) . '      </ul>';
  }
}sge;
$s =~ s{\Q$toc\E}{$new};
open $h, '>', $file or die "$file: $!"; print $h $s; close $h;
print "$n capítulos del índice rehechos en $file\n";
