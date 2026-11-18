import 'dart:convert';

import 'vietnamese_text.dart';

/// A product label document (`kind: product_label`) as a TSPL program for a
/// roll of die-cut labels, `columns` labels abreast.
///
/// The server decides what each label says and which barcode it prints; this
/// only places it: `SIZE` is the roll, each row of labels is laid out at
/// `x = column × (label width + gap)`, and rows that print the same labels are
/// sent once with `PRINT <rows>,1`. Text uses the printer's built-in fonts,
/// so it is ASCII without marks, as on a cup label.
class ProductLabelRenderer {
  const ProductLabelRenderer();

  static const _dotsPerMm = 8; // 203 dpi
  static const _maxColumns = 4;
  static const _maxLabels = 20000;
  static const _minBarcodeHeight = 24;
  static const _maxBarcodeHeight = 80;
  static const _readableHeight = 24;
  static const _barcodeGap = 4;
  static const _originalPrefix = 'Gia goc ';

  List<int> render(Map<String, Object?> document) {
    final spec = _LabelSpec.parse(document);
    final labels = _labels(document['labels']);
    final rows = _packRows(labels, spec.columns);
    if (rows.isEmpty) throw const FormatException('product_label: no labels to print');

    final program = <String>[
      'SIZE ${_mm(spec.rollWidthMm)} mm,${_mm(spec.heightMm)} mm',
      'GAP ${_mm(spec.gapMm)} mm,0 mm',
      'DIRECTION 1',
      'CLS',
    ];
    final layouts = <int, List<_Element>>{};
    for (var group = 0; group < rows.length; group++) {
      final (cells, count) = rows[group];
      if (group > 0) program.add('CLS');
      for (var column = 0; column < cells.length; column++) {
        final index = cells[column];
        if (index == null) continue; // an empty cell on the last row
        final elements = layouts.putIfAbsent(index, () => _layout(labels[index].rows, spec));
        final x = (column * (spec.widthMm + spec.columnGapMm) * _dotsPerMm).round();
        program.addAll([for (final element in elements) element.command(x)]);
      }
      program.add('PRINT $count,1');
    }
    program.add('');
    return ascii.encode(program.join('\r\n'));
  }

  /// The labels in print order, each cell naming its label by index, packed
  /// into rows of [columns]; consecutive rows of the same cells are one entry
  /// with their count. The last row may have empty cells.
  List<(List<int?>, int)> _packRows(List<_Label> labels, int columns) {
    final cells = <int>[];
    for (var index = 0; index < labels.length; index++) {
      for (var copy = 0; copy < labels[index].copies; copy++) {
        cells.add(index);
        if (cells.length > _maxLabels) throw const FormatException('product_label: too many labels');
      }
    }
    final groups = <(List<int?>, int)>[];
    for (var start = 0; start < cells.length; start += columns) {
      final row = <int?>[
        for (var column = 0; column < columns; column++) start + column < cells.length ? cells[start + column] : null,
      ];
      if (groups.isNotEmpty && _sameRow(groups.last.$1, row)) {
        groups.last = (groups.last.$1, groups.last.$2 + 1);
      } else {
        groups.add((row, 1));
      }
    }
    return groups;
  }

  bool _sameRow(List<int?> a, List<int?> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  List<_Element> _layout(List<Map<String, Object?>> rows, _LabelSpec spec) {
    final font = _Font.forSize(spec.fontSize);
    final left = spec.marginLeft;
    final width = spec.innerWidth;
    final bottom = spec.heightDots - spec.marginBottom;

    // Space the barcodes may take: what the other rows leave.
    var fixed = 0;
    var barcodes = 0;
    for (final row in rows) {
      switch (row['kind']) {
        case 'barcode':
          barcodes++;
          fixed += _barcodeGap;
          if (row['show_text'] == true) fixed += _readableHeight;
        case 'price':
          fixed += _priceFont(_foldedText(row), width).lineHeight;
          if (_foldedOriginal(row).isNotEmpty) fixed += _Font.small.lineHeight;
        default:
          final lines = _wrap(_foldedText(row), width ~/ font.charWidth, _maxLines(row));
          fixed += lines.length * font.lineHeight;
      }
    }
    final room = spec.heightDots - spec.marginTop - spec.marginBottom - fixed;
    final barcodeHeight = barcodes == 0 ? 0 : (room ~/ barcodes).clamp(_minBarcodeHeight, _maxBarcodeHeight);

    final elements = <_Element>[];
    var y = spec.marginTop;
    for (final row in rows) {
      switch (row['kind']) {
        case 'barcode':
          final value = foldToAscii('${row['value'] ?? ''}');
          if (value.isEmpty) continue;
          final readable = row['show_text'] == true;
          final height = barcodeHeight + (readable ? _readableHeight : 0);
          if (y + height > bottom) continue;
          final ean = row['symbology'] == 'ean13';
          final modules = ean ? 95 : 11 * (value.length + 2) + 13;
          final narrow = (modules + 20) * 3 <= width ? 3 : 2;
          final x = left + ((width - modules * narrow) ~/ 2).clamp(0, width);
          final type = ean ? 'EAN13' : '128';
          final top = y;
          elements.add(_Element(
            x,
            (at) => 'BARCODE $at,$top,"$type",$barcodeHeight,${readable ? 1 : 0},0,$narrow,${narrow * 2},"${_escape(value)}"',
          ));
          y += height + _barcodeGap;
        case 'price':
          final text = _foldedText(row);
          if (text.isEmpty) continue;
          final priceFont = _priceFont(text, width);
          // The original price only goes above a price that is printed.
          final original = _foldedOriginal(row);
          final small = original.isNotEmpty && y + _Font.small.lineHeight + priceFont.lineHeight <= bottom;
          if (!small && y + priceFont.lineHeight > bottom) continue;
          if (small) {
            final line = _cut('$_originalPrefix$original', width ~/ _Font.small.charWidth);
            elements.add(_text(left, y, _Font.small, line));
            y += _Font.small.lineHeight;
          }
          elements.add(_text(left, y, priceFont, _cut(text, width ~/ priceFont.charWidth)));
          y += priceFont.lineHeight;
        default:
          for (final line in _wrap(_foldedText(row), width ~/ font.charWidth, _maxLines(row))) {
            if (y + font.lineHeight > bottom) break;
            elements.add(_text(left, y, font, line));
            y += font.lineHeight;
          }
      }
    }
    return elements;
  }

  _Element _text(int left, int y, _Font font, String line) =>
      _Element(left, (at) => 'TEXT $at,$y,"${font.id}",0,1,1,"${_escape(line)}"');

  /// The price in the bigger font when it fits the label.
  _Font _priceFont(String text, int width) => text.length * _Font.large.charWidth <= width ? _Font.large : _Font.medium;

  String _foldedText(Map<String, Object?> row) => foldToAscii('${row['text'] ?? ''}').trim();

  String _foldedOriginal(Map<String, Object?> row) {
    final original = row['original'];
    return original is String ? foldToAscii(original).trim() : '';
  }

  int _maxLines(Map<String, Object?> row) {
    final value = row['max_lines'];
    return value is int && value >= 1 ? value.clamp(1, 3) : 1;
  }

  /// Words filled into lines of [columns] characters, at most [maxLines] of
  /// them; what does not fit is cut off.
  List<String> _wrap(String text, int columns, int maxLines) {
    if (text.isEmpty || columns < 1) return const [];
    final lines = <String>[];
    var line = '';
    for (var word in text.split(RegExp(r'\s+'))) {
      while (word.length > columns) {
        if (line.isNotEmpty) {
          lines.add(line);
          line = '';
        }
        lines.add(word.substring(0, columns));
        word = word.substring(columns);
      }
      if (line.isEmpty) {
        line = word;
      } else if (line.length + 1 + word.length <= columns) {
        line = '$line $word';
      } else {
        lines.add(line);
        line = word;
      }
    }
    if (line.isNotEmpty) lines.add(line);
    return lines.take(maxLines).toList();
  }

  String _cut(String text, int columns) => text.length <= columns ? text : text.substring(0, columns < 0 ? 0 : columns);

  /// TSPL strings cannot hold a bare double quote.
  String _escape(String value) => value.replaceAll('"', r'\["]');

  static String _mm(num value) => value == value.roundToDouble() ? '${value.round()}' : '$value';

  List<_Label> _labels(Object? value) {
    if (value is! List) throw const FormatException('product_label: labels missing');
    return [
      for (final item in value)
        if (item is Map) _Label.parse(item.cast<String, Object?>()),
    ];
  }
}

class _Label {
  const _Label(this.rows, this.copies);

  factory _Label.parse(Map<String, Object?> json) {
    final rows = json['rows'];
    final copies = json['copies'];
    return _Label(
      rows is List ? [for (final row in rows) if (row is Map) row.cast<String, Object?>()] : const [],
      copies is int && copies > 0 ? copies : 0,
    );
  }

  final List<Map<String, Object?>> rows;
  final int copies;
}

class _Element {
  const _Element(this.x, this.build);

  /// Where the element starts in its label; a column adds its own offset.
  final int x;
  final String Function(int x) build;

  String command(int columnOffset) => build(columnOffset + x);
}

/// The built-in TSPL fonts: id, character cell and the line they take.
class _Font {
  const _Font(this.id, this.charWidth, this.lineHeight);

  static const small = _Font('1', 8, 16);
  static const medium = _Font('2', 12, 24);
  static const large = _Font('3', 16, 28);

  /// Points to the nearest built-in font: 7 and under small, 8 to 11 medium.
  factory _Font.forSize(num points) => points <= 7
      ? small
      : points <= 11
          ? medium
          : large;

  final String id;
  final int charWidth;
  final int lineHeight;
}

class _LabelSpec {
  const _LabelSpec({
    required this.widthMm,
    required this.heightMm,
    required this.columns,
    required this.gapMm,
    required this.columnGapMm,
    required this.rollWidthMm,
    required this.fontSize,
    required this.marginTop,
    required this.marginRight,
    required this.marginBottom,
    required this.marginLeft,
  });

  factory _LabelSpec.parse(Map<String, Object?> document) {
    final page = document['page'];
    final label = page is Map ? page['label'] : null;
    if (label is! Map) throw const FormatException('product_label: page.label missing');
    num positive(String key, {num max = 400}) {
      final value = label[key];
      if (value is! num || value <= 0 || value > max) throw FormatException('product_label: page.label.$key is not valid');
      return value;
    }

    num atLeastZero(String key) {
      final value = label[key];
      if (value is! num || value < 0 || value > 50) throw FormatException('product_label: page.label.$key is not valid');
      return value;
    }

    final columns = label['columns'];
    if (columns is! int || columns < 1 || columns > ProductLabelRenderer._maxColumns) {
      throw const FormatException('product_label: page.label.columns is not valid');
    }
    final margins = document['margins'] is Map ? (document['margins']! as Map).cast<String, Object?>() : const <String, Object?>{};
    int margin(String side) {
      final value = margins[side];
      return value is num && value >= 0 && value <= 20 ? (value * ProductLabelRenderer._dotsPerMm).round() : 0;
    }

    final fontSize = document['font_size'];
    return _LabelSpec(
      widthMm: positive('width_mm'),
      heightMm: positive('height_mm'),
      columns: columns,
      gapMm: atLeastZero('gap_mm'),
      columnGapMm: atLeastZero('column_gap_mm'),
      rollWidthMm: positive('roll_width_mm'),
      fontSize: fontSize is num ? fontSize : 9,
      marginTop: margin('top'),
      marginRight: margin('right'),
      marginBottom: margin('bottom'),
      marginLeft: margin('left'),
    );
  }

  final num widthMm;
  final num heightMm;
  final int columns;
  final num gapMm;
  final num columnGapMm;
  final num rollWidthMm;
  final num fontSize;
  final int marginTop;
  final int marginRight;
  final int marginBottom;
  final int marginLeft;

  int get heightDots => (heightMm * ProductLabelRenderer._dotsPerMm).round();

  int get innerWidth {
    final width = (widthMm * ProductLabelRenderer._dotsPerMm).round() - marginLeft - marginRight;
    return width < 8 ? 8 : width;
  }
}
