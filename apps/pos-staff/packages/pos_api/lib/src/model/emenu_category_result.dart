//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/emenu_category.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_category_result.g.dart';

/// EmenuCategoryResult
///
/// Properties:
/// * [data]
@BuiltValue()
abstract class EmenuCategoryResult
    implements Built<EmenuCategoryResult, EmenuCategoryResultBuilder> {
  @BuiltValueField(wireName: r'data')
  EmenuCategory get data;

  EmenuCategoryResult._();

  factory EmenuCategoryResult([void updates(EmenuCategoryResultBuilder b)]) =
      _$EmenuCategoryResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuCategoryResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuCategoryResult> get serializer =>
      _$EmenuCategoryResultSerializer();
}

class _$EmenuCategoryResultSerializer
    implements PrimitiveSerializer<EmenuCategoryResult> {
  @override
  final Iterable<Type> types = const [
    EmenuCategoryResult,
    _$EmenuCategoryResult
  ];

  @override
  final String wireName = r'EmenuCategoryResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuCategoryResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(EmenuCategory),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuCategoryResult object, {
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
    required EmenuCategoryResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(EmenuCategory),
          ) as EmenuCategory;
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
  EmenuCategoryResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuCategoryResultBuilder();
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
