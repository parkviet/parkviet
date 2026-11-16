//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview_totals.g.dart';

/// OverviewTotals
///
/// Properties:
/// * [orders]
/// * [salesTotal]
/// * [returns]
/// * [returnsTotal]
/// * [netSales]
/// * [offlineOrders]
/// * [offlineTotal]
/// * [customers] - Distinct registered customers plus every order without a linked customer.
@BuiltValue()
abstract class OverviewTotals
    implements Built<OverviewTotals, OverviewTotalsBuilder> {
  @BuiltValueField(wireName: r'orders')
  int get orders;

  @BuiltValueField(wireName: r'sales_total')
  String get salesTotal;

  @BuiltValueField(wireName: r'returns')
  int get returns;

  @BuiltValueField(wireName: r'returns_total')
  String get returnsTotal;

  @BuiltValueField(wireName: r'net_sales')
  String get netSales;

  @BuiltValueField(wireName: r'offline_orders')
  int get offlineOrders;

  @BuiltValueField(wireName: r'offline_total')
  String get offlineTotal;

  /// Distinct registered customers plus every order without a linked customer.
  @BuiltValueField(wireName: r'customers')
  int get customers;

  OverviewTotals._();

  factory OverviewTotals([void updates(OverviewTotalsBuilder b)]) =
      _$OverviewTotals;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewTotalsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OverviewTotals> get serializer =>
      _$OverviewTotalsSerializer();
}

class _$OverviewTotalsSerializer
    implements PrimitiveSerializer<OverviewTotals> {
  @override
  final Iterable<Type> types = const [OverviewTotals, _$OverviewTotals];

  @override
  final String wireName = r'OverviewTotals';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OverviewTotals object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'orders';
    yield serializers.serialize(
      object.orders,
      specifiedType: const FullType(int),
    );
    yield r'sales_total';
    yield serializers.serialize(
      object.salesTotal,
      specifiedType: const FullType(String),
    );
    yield r'returns';
    yield serializers.serialize(
      object.returns,
      specifiedType: const FullType(int),
    );
    yield r'returns_total';
    yield serializers.serialize(
      object.returnsTotal,
      specifiedType: const FullType(String),
    );
    yield r'net_sales';
    yield serializers.serialize(
      object.netSales,
      specifiedType: const FullType(String),
    );
    yield r'offline_orders';
    yield serializers.serialize(
      object.offlineOrders,
      specifiedType: const FullType(int),
    );
    yield r'offline_total';
    yield serializers.serialize(
      object.offlineTotal,
      specifiedType: const FullType(String),
    );
    yield r'customers';
    yield serializers.serialize(
      object.customers,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OverviewTotals object, {
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
    required OverviewTotalsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'orders':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.orders = valueDes;
          break;
        case r'sales_total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.salesTotal = valueDes;
          break;
        case r'returns':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.returns = valueDes;
          break;
        case r'returns_total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.returnsTotal = valueDes;
          break;
        case r'net_sales':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.netSales = valueDes;
          break;
        case r'offline_orders':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.offlineOrders = valueDes;
          break;
        case r'offline_total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.offlineTotal = valueDes;
          break;
        case r'customers':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.customers = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OverviewTotals deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewTotalsBuilder();
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
