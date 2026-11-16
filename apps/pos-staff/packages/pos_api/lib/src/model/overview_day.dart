//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/date.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview_day.g.dart';

/// OverviewDay
///
/// Properties:
/// * [date]
/// * [orders]
/// * [customers]
/// * [salesTotal]
/// * [returnsTotal]
/// * [netSales]
@BuiltValue()
abstract class OverviewDay implements Built<OverviewDay, OverviewDayBuilder> {
  @BuiltValueField(wireName: r'date')
  Date get date;

  @BuiltValueField(wireName: r'orders')
  int get orders;

  @BuiltValueField(wireName: r'customers')
  int get customers;

  @BuiltValueField(wireName: r'sales_total')
  String get salesTotal;

  @BuiltValueField(wireName: r'returns_total')
  String get returnsTotal;

  @BuiltValueField(wireName: r'net_sales')
  String get netSales;

  OverviewDay._();

  factory OverviewDay([void updates(OverviewDayBuilder b)]) = _$OverviewDay;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewDayBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OverviewDay> get serializer => _$OverviewDaySerializer();
}

class _$OverviewDaySerializer implements PrimitiveSerializer<OverviewDay> {
  @override
  final Iterable<Type> types = const [OverviewDay, _$OverviewDay];

  @override
  final String wireName = r'OverviewDay';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OverviewDay object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'date';
    yield serializers.serialize(
      object.date,
      specifiedType: const FullType(Date),
    );
    yield r'orders';
    yield serializers.serialize(
      object.orders,
      specifiedType: const FullType(int),
    );
    yield r'customers';
    yield serializers.serialize(
      object.customers,
      specifiedType: const FullType(int),
    );
    yield r'sales_total';
    yield serializers.serialize(
      object.salesTotal,
      specifiedType: const FullType(String),
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
  }

  @override
  Object serialize(
    Serializers serializers,
    OverviewDay object, {
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
    required OverviewDayBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'date':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(Date),
          ) as Date;
          result.date = valueDes;
          break;
        case r'orders':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.orders = valueDes;
          break;
        case r'customers':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.customers = valueDes;
          break;
        case r'sales_total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.salesTotal = valueDes;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OverviewDay deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewDayBuilder();
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
