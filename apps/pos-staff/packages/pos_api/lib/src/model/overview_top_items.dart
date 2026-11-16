//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/overview_item.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview_top_items.g.dart';

/// OverviewTopItems
///
/// Properties:
/// * [byQuantity]
/// * [byRevenue]
@BuiltValue()
abstract class OverviewTopItems
    implements Built<OverviewTopItems, OverviewTopItemsBuilder> {
  @BuiltValueField(wireName: r'by_quantity')
  BuiltList<OverviewItem> get byQuantity;

  @BuiltValueField(wireName: r'by_revenue')
  BuiltList<OverviewItem> get byRevenue;

  OverviewTopItems._();

  factory OverviewTopItems([void updates(OverviewTopItemsBuilder b)]) =
      _$OverviewTopItems;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewTopItemsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OverviewTopItems> get serializer =>
      _$OverviewTopItemsSerializer();
}

class _$OverviewTopItemsSerializer
    implements PrimitiveSerializer<OverviewTopItems> {
  @override
  final Iterable<Type> types = const [OverviewTopItems, _$OverviewTopItems];

  @override
  final String wireName = r'OverviewTopItems';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OverviewTopItems object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'by_quantity';
    yield serializers.serialize(
      object.byQuantity,
      specifiedType: const FullType(BuiltList, [FullType(OverviewItem)]),
    );
    yield r'by_revenue';
    yield serializers.serialize(
      object.byRevenue,
      specifiedType: const FullType(BuiltList, [FullType(OverviewItem)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OverviewTopItems object, {
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
    required OverviewTopItemsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'by_quantity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OverviewItem)]),
          ) as BuiltList<OverviewItem>;
          result.byQuantity.replace(valueDes);
          break;
        case r'by_revenue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OverviewItem)]),
          ) as BuiltList<OverviewItem>;
          result.byRevenue.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OverviewTopItems deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewTopItemsBuilder();
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
