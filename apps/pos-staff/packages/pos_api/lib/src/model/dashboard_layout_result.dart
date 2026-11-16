//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/dashboard_layout.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'dashboard_layout_result.g.dart';

/// DashboardLayoutResult
///
/// Properties:
/// * [data]
@BuiltValue()
abstract class DashboardLayoutResult
    implements Built<DashboardLayoutResult, DashboardLayoutResultBuilder> {
  @BuiltValueField(wireName: r'data')
  DashboardLayout? get data;

  DashboardLayoutResult._();

  factory DashboardLayoutResult(
      [void updates(DashboardLayoutResultBuilder b)]) = _$DashboardLayoutResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DashboardLayoutResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DashboardLayoutResult> get serializer =>
      _$DashboardLayoutResultSerializer();
}

class _$DashboardLayoutResultSerializer
    implements PrimitiveSerializer<DashboardLayoutResult> {
  @override
  final Iterable<Type> types = const [
    DashboardLayoutResult,
    _$DashboardLayoutResult
  ];

  @override
  final String wireName = r'DashboardLayoutResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DashboardLayoutResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield object.data == null
        ? null
        : serializers.serialize(
            object.data,
            specifiedType: const FullType.nullable(DashboardLayout),
          );
  }

  @override
  Object serialize(
    Serializers serializers,
    DashboardLayoutResult object, {
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
    required DashboardLayoutResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DashboardLayout),
          ) as DashboardLayout?;
          if (valueDes == null) continue;
          result.data.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DashboardLayoutResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DashboardLayoutResultBuilder();
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
