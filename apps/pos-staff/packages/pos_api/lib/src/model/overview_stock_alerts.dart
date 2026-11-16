//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview_stock_alerts.g.dart';

/// OverviewStockAlerts
///
/// Properties:
/// * [outOfStock]
/// * [lowStock]
/// * [expiringSoon]
/// * [nearExpiryDays]
@BuiltValue()
abstract class OverviewStockAlerts
    implements Built<OverviewStockAlerts, OverviewStockAlertsBuilder> {
  @BuiltValueField(wireName: r'out_of_stock')
  int get outOfStock;

  @BuiltValueField(wireName: r'low_stock')
  int get lowStock;

  @BuiltValueField(wireName: r'expiring_soon')
  int get expiringSoon;

  @BuiltValueField(wireName: r'near_expiry_days')
  int get nearExpiryDays;

  OverviewStockAlerts._();

  factory OverviewStockAlerts([void updates(OverviewStockAlertsBuilder b)]) =
      _$OverviewStockAlerts;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewStockAlertsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OverviewStockAlerts> get serializer =>
      _$OverviewStockAlertsSerializer();
}

class _$OverviewStockAlertsSerializer
    implements PrimitiveSerializer<OverviewStockAlerts> {
  @override
  final Iterable<Type> types = const [
    OverviewStockAlerts,
    _$OverviewStockAlerts
  ];

  @override
  final String wireName = r'OverviewStockAlerts';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OverviewStockAlerts object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'out_of_stock';
    yield serializers.serialize(
      object.outOfStock,
      specifiedType: const FullType(int),
    );
    yield r'low_stock';
    yield serializers.serialize(
      object.lowStock,
      specifiedType: const FullType(int),
    );
    yield r'expiring_soon';
    yield serializers.serialize(
      object.expiringSoon,
      specifiedType: const FullType(int),
    );
    yield r'near_expiry_days';
    yield serializers.serialize(
      object.nearExpiryDays,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OverviewStockAlerts object, {
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
    required OverviewStockAlertsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'out_of_stock':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.outOfStock = valueDes;
          break;
        case r'low_stock':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.lowStock = valueDes;
          break;
        case r'expiring_soon':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.expiringSoon = valueDes;
          break;
        case r'near_expiry_days':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.nearExpiryDays = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OverviewStockAlerts deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewStockAlertsBuilder();
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
