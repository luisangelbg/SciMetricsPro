/* Fixture: comma-separated export of the multidisciplinary citation index A (partial set of columns).
   Synthetic records written with the layout of a real export: quoted fields, a line
   break inside the abstract, an author with two affiliations joined by a comma, a
   reference with "; " inside, an empty citation count, an untitled record. */
window.FIXTURES = window.FIXTURES || {};
(function () {
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const header = ['Authors', 'Author full names', 'Author(s) ID', 'Title', 'Year', 'Source title', 'Volume', 'Issue', 'Art. No.',
    'Page start', 'Page end', 'Cited by', 'DOI', 'Link', 'Affiliations', 'Authors with affiliations', 'Abstract', 'Author Keywords',
    'Index Keywords', 'References', 'Correspondence Address', 'Publisher', 'ISSN', 'PubMed ID', 'Language of Original Document',
    'Abbreviated Source Title', 'Document Type', 'Publication Stage', 'Open Access', 'Source', 'EID'];
  const rows = [
    [
      'Ramírez-Ojeda G.; Cadena-Iñiguez J.', 'Ramírez-Ojeda, Gabriela (57191977705); Cadena-Iñiguez, Jorge (23032961600)', '57191977705; 23032961600',
      'Ecogeography of forage grasses, from arid to "semi-arid" regions', '2024', 'Grasses', '3', '2', '', '110', '129', '12',
      '10.3390/grasses3020008', 'https://example.org/record?id=1',
      'Campo Experimental Altos de Jalisco, Tepatitlán de Morelos, 44714, Mexico; Colegio de Postgraduados, Salinas de Hidalgo, 78600, Mexico; Grupo de Investigación en Sechium edule (GISeM), Texcoco, 56153, Mexico',
      'Ramírez-Ojeda G., Campo Experimental Altos de Jalisco, Tepatitlán de Morelos, 44714, Mexico; Cadena-Iñiguez J., Colegio de Postgraduados, Salinas de Hidalgo, 78600, Mexico, Grupo de Investigación en Sechium edule (GISeM), Texcoco, 56153, Mexico',
      'Arid areas are productive ecosystems.\nGrasses stand out among their species.', 'arid regions; climate change; Ecogeography; ecogeography',
      'grassland; climate', 'Toledo V.M., Ordonez M., The biodiversity scenario of Mexico, Biological Diversity of Mexico, pp. 739-755, (1993); Aguirre-Medina J. F., Cadena-Iniguez J., Chayote in home gardens, Rev Mex Cienc Agric, 12, 3, pp. 1-9, (2021); Example Agency, One health approach. Advancing global health security. Example Press; 2024, pp. 1-21',
      'G. Ramírez-Ojeda; Campo Experimental Altos de Jalisco, Tepatitlán de Morelos, 44714, Mexico; email: g@example.org', 'Example Publishing',
      '28133463', '', 'Spanish; English', 'Grasses', 'Article', 'Final', 'All Open Access; Gold Open Access', 'Example', '2-s2.0-105009505729',
    ],
    [
      'Smith J., Jones K.L.', '', '', 'A conference record', '2022', 'Proceedings of an Example Meeting', '', '', '4', '', '', '',
      '', '', '', '', '[No abstract available]', '', 'maize; landraces', 'Smith, J., Brown, A., Old style title (2010) Example Journal, 12 (3), pp. 45-67.',
      '', '', '', '', 'English', '', 'Conference paper', 'Final', '', 'Example', '2-s2.0-85000000002',
    ],
    [
      'Nobody N.', 'Nobody, Nemo (1)', '', '', '2020', 'Untitled Journal', '', '', '', '', '', '3',
      '', '', '', '', '', '', '', '', '', '', '', '', 'English', '', 'Article', 'Final', '', 'Example', '2-s2.0-85000000003',
    ],
  ];
  window.FIXTURES.idxaCsv = '\uFEFF' + [header.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n') + '\r\n';
})();
