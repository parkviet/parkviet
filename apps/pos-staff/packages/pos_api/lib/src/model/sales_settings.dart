//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'sales_settings.g.dart';

/// Per-branch selling options. A missing key reads as its default, so a branch saved before a key existed stays usable.
///
/// Properties:
/// * [allowOversell]
/// * [warnBelowCost]
/// * [showStock]
/// * [showCost]
/// * [cartOrder]
/// * [orderNote]
/// * [coupons]
/// * [paymentChime]
/// * [autoPrintReceipt]
/// * [inlineVariants] - Sizes, attributes and sale units show on each selling-list row.
/// * [scheduledDelivery] - Show a delivery date and time on a delivery order. The order's business date stays the shift's date.
/// * [autoPrintPrebill] - Print a pre-bill when an unpaid order is parked or sent to the kitchen. A branch that records pre-bills prints automatically only the first time.
/// * [printVoidTickets] - Queue a void ticket for the kitchen station printer. When false the void still shows on the kitchen screen and stays on the order.
/// * [autoPrintReadyTicket] - Queue a runner ready ticket when kitchen items move to `ready` on a kitchen screen.
/// * [allowSheetReceipts] - Offer sheet-paper templates (A4, A5, A6) in the counter print dialog, printed through the browser print dialog.
@BuiltValue()
abstract class SalesSettings
    implements Built<SalesSettings, SalesSettingsBuilder> {
  @BuiltValueField(wireName: r'allow_oversell')
  bool? get allowOversell;

  @BuiltValueField(wireName: r'warn_below_cost')
  bool? get warnBelowCost;

  @BuiltValueField(wireName: r'show_stock')
  bool? get showStock;

  @BuiltValueField(wireName: r'show_cost')
  bool? get showCost;

  @BuiltValueField(wireName: r'cart_order')
  SalesSettingsCartOrderEnum? get cartOrder;
  // enum cartOrderEnum {  newest_first,  oldest_first,  };

  @BuiltValueField(wireName: r'order_note')
  bool? get orderNote;

  @BuiltValueField(wireName: r'coupons')
  bool? get coupons;

  @BuiltValueField(wireName: r'payment_chime')
  SalesSettingsPaymentChimeEnum? get paymentChime;
  // enum paymentChimeEnum {  off,  default,  };

  @BuiltValueField(wireName: r'auto_print_receipt')
  bool? get autoPrintReceipt;

  /// Sizes, attributes and sale units show on each selling-list row.
  @BuiltValueField(wireName: r'inline_variants')
  bool? get inlineVariants;

  /// Show a delivery date and time on a delivery order. The order's business date stays the shift's date.
  @BuiltValueField(wireName: r'scheduled_delivery')
  bool? get scheduledDelivery;

  /// Print a pre-bill when an unpaid order is parked or sent to the kitchen. A branch that records pre-bills prints automatically only the first time.
  @BuiltValueField(wireName: r'auto_print_prebill')
  bool? get autoPrintPrebill;

  /// Queue a void ticket for the kitchen station printer. When false the void still shows on the kitchen screen and stays on the order.
  @BuiltValueField(wireName: r'print_void_tickets')
  bool? get printVoidTickets;

  /// Queue a runner ready ticket when kitchen items move to `ready` on a kitchen screen.
  @BuiltValueField(wireName: r'auto_print_ready_ticket')
  bool? get autoPrintReadyTicket;

  /// Offer sheet-paper templates (A4, A5, A6) in the counter print dialog, printed through the browser print dialog.
  @BuiltValueField(wireName: r'allow_sheet_receipts')
  bool? get allowSheetReceipts;

  SalesSettings._();

  factory SalesSettings([void updates(SalesSettingsBuilder b)]) =
      _$SalesSettings;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SalesSettingsBuilder b) => b
    ..allowOversell = true
    ..warnBelowCost = false
    ..showStock = true
    ..showCost = false
    ..cartOrder = SalesSettingsCartOrderEnum.valueOf('oldest_first')
    ..orderNote = true
    ..coupons = true
    ..paymentChime = SalesSettingsPaymentChimeEnum.valueOf('default')
    ..autoPrintReceipt = false
    ..inlineVariants = false
    ..scheduledDelivery = false
    ..autoPrintPrebill = false
    ..printVoidTickets = true
    ..autoPrintReadyTicket = false
    ..allowSheetReceipts = true;

  @BuiltValueSerializer(custom: true)
  static Serializer<SalesSettings> get serializer =>
      _$SalesSettingsSerializer();
}

class _$SalesSettingsSerializer implements PrimitiveSerializer<SalesSettings> {
  @override
  final Iterable<Type> types = const [SalesSettings, _$SalesSettings];

  @override
  final String wireName = r'SalesSettings';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SalesSettings object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.allowOversell != null) {
      yield r'allow_oversell';
      yield serializers.serialize(
        object.allowOversell,
        specifiedType: const FullType(bool),
      );
    }
    if (object.warnBelowCost != null) {
      yield r'warn_below_cost';
      yield serializers.serialize(
        object.warnBelowCost,
        specifiedType: const FullType(bool),
      );
    }
    if (object.showStock != null) {
      yield r'show_stock';
      yield serializers.serialize(
        object.showStock,
        specifiedType: const FullType(bool),
      );
    }
    if (object.showCost != null) {
      yield r'show_cost';
      yield serializers.serialize(
        object.showCost,
        specifiedType: const FullType(bool),
      );
    }
    if (object.cartOrder != null) {
      yield r'cart_order';
      yield serializers.serialize(
        object.cartOrder,
        specifiedType: const FullType(SalesSettingsCartOrderEnum),
      );
    }
    if (object.orderNote != null) {
      yield r'order_note';
      yield serializers.serialize(
        object.orderNote,
        specifiedType: const FullType(bool),
      );
    }
    if (object.coupons != null) {
      yield r'coupons';
      yield serializers.serialize(
        object.coupons,
        specifiedType: const FullType(bool),
      );
    }
    if (object.paymentChime != null) {
      yield r'payment_chime';
      yield serializers.serialize(
        object.paymentChime,
        specifiedType: const FullType(SalesSettingsPaymentChimeEnum),
      );
    }
    if (object.autoPrintReceipt != null) {
      yield r'auto_print_receipt';
      yield serializers.serialize(
        object.autoPrintReceipt,
        specifiedType: const FullType(bool),
      );
    }
    if (object.inlineVariants != null) {
      yield r'inline_variants';
      yield serializers.serialize(
        object.inlineVariants,
        specifiedType: const FullType(bool),
      );
    }
    if (object.scheduledDelivery != null) {
      yield r'scheduled_delivery';
      yield serializers.serialize(
        object.scheduledDelivery,
        specifiedType: const FullType(bool),
      );
    }
    if (object.autoPrintPrebill != null) {
      yield r'auto_print_prebill';
      yield serializers.serialize(
        object.autoPrintPrebill,
        specifiedType: const FullType(bool),
      );
    }
    if (object.printVoidTickets != null) {
      yield r'print_void_tickets';
      yield serializers.serialize(
        object.printVoidTickets,
        specifiedType: const FullType(bool),
      );
    }
    if (object.autoPrintReadyTicket != null) {
      yield r'auto_print_ready_ticket';
      yield serializers.serialize(
        object.autoPrintReadyTicket,
        specifiedType: const FullType(bool),
      );
    }
    if (object.allowSheetReceipts != null) {
      yield r'allow_sheet_receipts';
      yield serializers.serialize(
        object.allowSheetReceipts,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    SalesSettings object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object,
            specifiedType: specifiedType)
        .toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SalesSettingsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'allow_oversell':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.allowOversell = valueDes;
          break;
        case r'warn_below_cost':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.warnBelowCost = valueDes;
          break;
        case r'show_stock':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.showStock = valueDes;
          break;
        case r'show_cost':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.showCost = valueDes;
          break;
        case r'cart_order':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(SalesSettingsCartOrderEnum),
          ) as SalesSettingsCartOrderEnum?;
          if (valueDes == null) continue;
          result.cartOrder = valueDes;
          break;
        case r'order_note':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.orderNote = valueDes;
          break;
        case r'coupons':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.coupons = valueDes;
          break;
        case r'payment_chime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(SalesSettingsPaymentChimeEnum),
          ) as SalesSettingsPaymentChimeEnum?;
          if (valueDes == null) continue;
          result.paymentChime = valueDes;
          break;
        case r'auto_print_receipt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.autoPrintReceipt = valueDes;
          break;
        case r'inline_variants':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.inlineVariants = valueDes;
          break;
        case r'scheduled_delivery':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.scheduledDelivery = valueDes;
          break;
        case r'auto_print_prebill':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.autoPrintPrebill = valueDes;
          break;
        case r'print_void_tickets':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.printVoidTickets = valueDes;
          break;
        case r'auto_print_ready_ticket':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.autoPrintReadyTicket = valueDes;
          break;
        case r'allow_sheet_receipts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.allowSheetReceipts = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SalesSettings deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SalesSettingsBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class SalesSettingsCartOrderEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'newest_first')
  static const SalesSettingsCartOrderEnum newestFirst =
      _$salesSettingsCartOrderEnum_newestFirst;
  @BuiltValueEnumConst(wireName: r'oldest_first')
  static const SalesSettingsCartOrderEnum oldestFirst =
      _$salesSettingsCartOrderEnum_oldestFirst;

  static Serializer<SalesSettingsCartOrderEnum> get serializer =>
      _$salesSettingsCartOrderEnumSerializer;

  const SalesSettingsCartOrderEnum._(String name) : super(name);

  static BuiltSet<SalesSettingsCartOrderEnum> get values =>
      _$salesSettingsCartOrderEnumValues;
  static SalesSettingsCartOrderEnum valueOf(String name) =>
      _$salesSettingsCartOrderEnumValueOf(name);
}

class SalesSettingsPaymentChimeEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'off')
  static const SalesSettingsPaymentChimeEnum off =
      _$salesSettingsPaymentChimeEnum_off;
  @BuiltValueEnumConst(wireName: r'default')
  static const SalesSettingsPaymentChimeEnum default_ =
      _$salesSettingsPaymentChimeEnum_default_;

  static Serializer<SalesSettingsPaymentChimeEnum> get serializer =>
      _$salesSettingsPaymentChimeEnumSerializer;

  const SalesSettingsPaymentChimeEnum._(String name) : super(name);

  static BuiltSet<SalesSettingsPaymentChimeEnum> get values =>
      _$salesSettingsPaymentChimeEnumValues;
  static SalesSettingsPaymentChimeEnum valueOf(String name) =>
      _$salesSettingsPaymentChimeEnumValueOf(name);
}
