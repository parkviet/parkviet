import 'drivers/printer_driver.dart';
import 'escpos_renderer.dart';
import 'print_commands.dart';
import 'printer_profile.dart';
import 'product_label_renderer.dart';
import 'tspl_renderer.dart';

/// A PrintDocument v1 as the bytes its printer's command language takes.
class DocumentRenderer {
  const DocumentRenderer({required this.escPos, this.tspl = const TsplRenderer()});

  static const _productLabels = ProductLabelRenderer();

  final EscPosRenderer escPos;
  final TsplRenderer tspl;

  Future<List<int>> render(Map<String, Object?> document, PrinterProfile printer) async {
    // A product label is a roll of stickers, not a ticket: it has its own
    // renderer and only a label printer can take it. Failing here reports
    // the job as failed instead of printing a ticket of garbage.
    if (document['kind'] == 'product_label') {
      if (!printer.isTspl) {
        throw const PrinterDeliveryError('Product labels need a TSPL label printer; this printer takes ESC/POS.');
      }
      return _productLabels.render(document);
    }
    final commands = documentCommands(document, printer);
    return printer.isTspl
        ? tspl.render(commands, printer, label: documentLabel(document))
        : escPos.render(commands, printer);
  }
}
