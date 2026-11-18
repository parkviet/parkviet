//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'reservation_period.g.dart';

/// ReservationPeriod
///
/// Properties:
/// * [start]
/// * [end]
@BuiltValue()
abstract class ReservationPeriod
    implements Built<ReservationPeriod, ReservationPeriodBuilder> {
  @BuiltValueField(wireName: r'start')
  String get start;

  @BuiltValueField(wireName: r'end')
  String get end;

  ReservationPeriod._();

  factory ReservationPeriod([void updates(ReservationPeriodBuilder b)]) =
      _$ReservationPeriod;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ReservationPeriodBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ReservationPeriod> get serializer =>
      _$ReservationPeriodSerializer();
}

class _$ReservationPeriodSerializer
    implements PrimitiveSerializer<ReservationPeriod> {
  @override
  final Iterable<Type> types = const [ReservationPeriod, _$ReservationPeriod];

  @override
  final String wireName = r'ReservationPeriod';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ReservationPeriod object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'start';
    yield serializers.serialize(
      object.start,
      specifiedType: const FullType(String),
    );
    yield r'end';
    yield serializers.serialize(
      object.end,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    ReservationPeriod object, {
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
    required ReservationPeriodBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'start':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.start = valueDes;
          break;
        case r'end':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.end = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ReservationPeriod deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ReservationPeriodBuilder();
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
