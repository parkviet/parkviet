//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/emenu_category.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_menu_result.g.dart';

/// EmenuMenuResult
///
/// Properties:
/// * [data]
@BuiltValue()
abstract class EmenuMenuResult
    implements Built<EmenuMenuResult, EmenuMenuResultBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<EmenuCategory> get data;

  EmenuMenuResult._();

  factory EmenuMenuResult([void updates(EmenuMenuResultBuilder b)]) =
      _$EmenuMenuResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuMenuResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuMenuResult> get serializer =>
      _$EmenuMenuResultSerializer();
}

class _$EmenuMenuResultSerializer
    implements PrimitiveSerializer<EmenuMenuResult> {
  @override
  final Iterable<Type> types = const [EmenuMenuResult, _$EmenuMenuResult];

  @override
  final String wireName = r'EmenuMenuResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuMenuResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BuiltList, [FullType(EmenuCategory)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuMenuResult object, {
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
    required EmenuMenuResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(EmenuCategory)]),
          ) as BuiltList<EmenuCategory>;
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
  EmenuMenuResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuMenuResultBuilder();
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
