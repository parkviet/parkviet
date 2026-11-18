import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:parkviet_staff/modes/print_station/document_renderer.dart';
import 'package:parkviet_staff/modes/print_station/drivers/printer_driver.dart';
import 'package:parkviet_staff/modes/print_station/escpos_renderer.dart';
import 'package:parkviet_staff/modes/print_station/printer_profile.dart';
import 'package:parkviet_staff/modes/print_station/product_label_renderer.dart';

import 'escpos_renderer_test.dart' show expectBytesGolden;

/// The documents the server builds in its own product label specs, so the
/// station is checked against what the server really sends.
const fixtures = '../../server/spec/fixtures/product_labels';

Map<String, Object?> fixtureDocument(String name) {
  final json = jsonDecode(File('$fixtures/$name.json').readAsStringSync()) as Map<String, Object?>;
  return (json['document']! as Map).cast<String, Object?>();
}

List<String> fixtureNames() => [
      for (final file in Directory(fixtures).listSync().whereType<File>())
        if (file.path.endsWith('.json')) file.uri.pathSegments.last.replaceAll('.json', ''),
    ]..sort();

Map<String, Object?> document({
  int columns = 1,
  num width = 50,
  num height = 30,
  num gap = 2,
  num columnGap = 0,
  num rollWidth = 50,
  List<Map<String, Object?>> labels = const [],
}) =>
    {
      'version': 1,
      'kind': 'product_label',
      'page': {
        'label': {
          'width_mm': width,
          'height_mm': height,
          'columns': columns,
          'gap_mm': gap,
          'column_gap_mm': columnGap,
          'roll_width_mm': rollWidth,
        },
      },
      'font_size': 9,
      'margins': {'top': 1, 'right': 1, 'bottom': 1, 'left': 1},
      'labels': labels,
    };

Map<String, Object?> label(List<Map<String, Object?>> rows, int copies) => {'rows': rows, 'copies': copies};

const name = {'kind': 'text', 'text': 'Sữa "tươi" 1L', 'max_lines': 2};
const ean = {'kind': 'barcode', 'symbology': 'ean13', 'value': '8934563138165', 'show_text': true};
const price = {'kind': 'price', 'text': '32.000 ₫'};

List<String> program(Map<String, Object?> doc) =>
    ascii.decode(const ProductLabelRenderer().render(doc)).split('\r\n');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('server documents', () {
    for (final fixture in fixtureNames()) {
      test('$fixture matches its golden bytes', () {
        final bytes = const ProductLabelRenderer().render(fixtureDocument(fixture));
        expectBytesGolden(bytes, 'product-label-$fixture.tspl');
      });
    }
  });

  group('roll layout', () {
    test('sizes the roll and the gap, and prints one row once', () {
      final lines = program(document(labels: [label([name, ean, price], 1)]));

      expect(lines.take(4), ['SIZE 50 mm,30 mm', 'GAP 2 mm,0 mm', 'DIRECTION 1', 'CLS']);
      expect(lines.sublist(lines.length - 2), ['PRINT 1,1', '']);
    });

    test('folds text to ASCII and escapes quotes', () {
      final lines = program(document(labels: [label([name], 1)]));

      expect(lines, contains(r'TEXT 8,8,"2",0,1,1,"Sua \["]tuoi\["] 1L"'));
    });

    test('prints identical rows once with their count', () {
      final lines = program(document(columns: 3, width: 33, height: 22, columnGap: 2, rollWidth: 110, labels: [
        label([price], 7),
      ]));

      expect(lines.where((line) => line.startsWith('PRINT')), ['PRINT 2,1', 'PRINT 1,1']);
    });

    test('places each column at its own offset and leaves the missing cell empty', () {
      final lines = program(document(columns: 3, width: 33, height: 22, columnGap: 2, rollWidth: 110, labels: [
        label([price], 8),
      ]));
      final last = lines.sublist(lines.lastIndexOf('CLS'));

      // 8 dots a millimetre: columns at 0 and 35 mm = 280 dots; the third cell is empty.
      expect(last.where((line) => line.startsWith('TEXT')).map((line) => line.split(',').first), ['TEXT 8', 'TEXT 288']);
    });

    test('packs different labels into one row and splits them across rows', () {
      final lines = program(document(columns: 2, width: 35, height: 25, columnGap: 3, rollWidth: 75, labels: [
        label([price], 3),
        label([price], 1),
      ]));

      // A A | A B: no two rows alike.
      expect(lines.where((line) => line.startsWith('PRINT')), ['PRINT 1,1', 'PRINT 1,1']);
      expect(lines.where((line) => line == 'CLS'), hasLength(2));
    });
  });

  group('rows', () {
    test('prints EAN-13 and Code 128 with their symbology and the readable text', () {
      final lines = program(document(labels: [
        label([ean], 1),
        label([
          {'kind': 'barcode', 'symbology': 'code128', 'value': 'SP-1', 'show_text': false},
        ], 1),
      ]));

      expect(lines.where((line) => line.startsWith('BARCODE')), [
        contains(',"EAN13",'),
        contains(',"128",'),
      ]);
      expect(lines.firstWhere((line) => line.contains('"EAN13"')), endsWith(',1,0,3,6,"8934563138165"'));
      expect(lines.firstWhere((line) => line.contains('"128"')), endsWith(',0,0,3,6,"SP-1"'));
    });

    test('prints the original price small above the price', () {
      final lines = program(document(labels: [
        label([
          {...price, 'original': '40.000 ₫'},
        ], 1),
      ]));

      expect(lines, contains('TEXT 8,8,"1",0,1,1,"Gia goc 40.000 d"'));
      expect(lines, contains('TEXT 8,24,"3",0,1,1,"32.000 d"'));
    });

    test('wraps the name to its lines and cuts the rest', () {
      final lines = program(document(width: 30, labels: [
        label([
          {'kind': 'text', 'text': 'Banh quy bo sua thuong hang dac biet', 'max_lines': 2},
        ], 1),
      ]));

      // 224 dots inside the margins, 12 a character: 18 per line.
      expect(lines.where((line) => line.startsWith('TEXT')), [
        'TEXT 8,8,"2",0,1,1,"Banh quy bo sua"',
        'TEXT 8,32,"2",0,1,1,"thuong hang dac"',
      ]);
    });

    test('drops rows that do not fit the label height', () {
      final rows = [for (var i = 0; i < 12; i++) {'kind': 'text', 'text': 'Dong $i'}];
      final lines = program(document(height: 15, labels: [label(rows, 1)]));

      expect(lines.where((line) => line.startsWith('TEXT')), hasLength(lessThan(8)));
    });
  });

  group('refusals', () {
    test('rejects a document without its label size', () {
      expect(() => const ProductLabelRenderer().render({'kind': 'product_label', 'labels': []}), throwsFormatException);
    });

    test('rejects a document with nothing to print', () {
      expect(() => const ProductLabelRenderer().render(document()), throwsFormatException);
      expect(() => const ProductLabelRenderer().render(document(labels: [label([price], 0)])), throwsFormatException);
    });

    test('rejects a roll with more columns than a station lays out', () {
      expect(
        () => const ProductLabelRenderer().render(document(columns: 9, labels: [label([price], 1)])),
        throwsFormatException,
      );
    });
  });

  group('station routing', () {
    late DocumentRenderer renderer;
    setUpAll(() async => renderer = DocumentRenderer(escPos: await EscPosRenderer.load()));

    PrinterProfile printer(String language) => PrinterProfile(
          id: 'posprn_1',
          name: 'Tem',
          connection: PrinterProfile.lan,
          address: '10.0.0.6',
          paper: '58mm',
          commandLanguage: language,
        );

    test('sends a product label to a TSPL printer as labels, not a ticket', () async {
      final bytes = await renderer.render(document(labels: [label([price], 1)]), printer('tspl'));

      expect(ascii.decode(bytes), startsWith('SIZE 50 mm,30 mm'));
    });

    test('fails a product label sent to an ESC/POS printer with a clear error', () {
      expect(
        renderer.render(document(labels: [label([price], 1)]), printer('escpos')),
        throwsA(isA<PrinterDeliveryError>().having((error) => error.message, 'message', contains('TSPL'))),
      );
    });
  });
}
