//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview_status_counts.g.dart';

/// OverviewStatusCounts
///
/// Properties:
/// * [all]
/// * [debt]
/// * [returned]
/// * [refundPending]
@BuiltValue()
abstract class OverviewStatusCounts
    implements Built<OverviewStatusCounts, OverviewStatusCountsBuilder> {
  @BuiltValueField(wireName: r'all')
  int get all;

  @BuiltValueField(wireName: r'debt')
  int get debt;

  @BuiltValueField(wireName: r'returned')
  int get returned;

  @BuiltValueField(wireName: r'refund_pending')
  int get refundPending;

  OverviewStatusCounts._();

  factory OverviewStatusCounts([void updates(OverviewStatusCountsBuilder b)]) =
      _$OverviewStatusCounts;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewStatusCountsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OverviewStatusCounts> get serializer =>
      _$OverviewStatusCountsSerializer();
}

class _$OverviewStatusCountsSerializer
    implements PrimitiveSerializer<OverviewStatusCounts> {
  @override
  final Iterable<Type> types = const [
    OverviewStatusCounts,
    _$OverviewStatusCounts
  ];

  @override
  final String wireName = r'OverviewStatusCounts';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OverviewStatusCounts object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'all';
    yield serializers.serialize(
      object.all,
      specifiedType: const FullType(int),
    );
    yield r'debt';
    yield serializers.serialize(
      object.debt,
      specifiedType: const FullType(int),
    );
    yield r'returned';
    yield serializers.serialize(
      object.returned,
      specifiedType: const FullType(int),
    );
    yield r'refund_pending';
    yield serializers.serialize(
      object.refundPending,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OverviewStatusCounts object, {
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
    required OverviewStatusCountsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'all':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.all = valueDes;
          break;
        case r'debt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.debt = valueDes;
          break;
        case r'returned':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.returned = valueDes;
          break;
        case r'refund_pending':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.refundPending = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OverviewStatusCounts deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewStatusCountsBuilder();
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
