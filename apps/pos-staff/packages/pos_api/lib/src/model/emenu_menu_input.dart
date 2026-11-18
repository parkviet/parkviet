//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/emenu_menu_category_input.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_menu_input.g.dart';

/// EmenuMenuInput
///
/// Properties:
/// * [branchId]
/// * [categories]
@BuiltValue()
abstract class EmenuMenuInput
    implements Built<EmenuMenuInput, EmenuMenuInputBuilder> {
  @BuiltValueField(wireName: r'branch_id')
  String get branchId;

  @BuiltValueField(wireName: r'categories')
  BuiltList<EmenuMenuCategoryInput> get categories;

  EmenuMenuInput._();

  factory EmenuMenuInput([void updates(EmenuMenuInputBuilder b)]) =
      _$EmenuMenuInput;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuMenuInputBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuMenuInput> get serializer =>
      _$EmenuMenuInputSerializer();
}

class _$EmenuMenuInputSerializer
    implements PrimitiveSerializer<EmenuMenuInput> {
  @override
  final Iterable<Type> types = const [EmenuMenuInput, _$EmenuMenuInput];

  @override
  final String wireName = r'EmenuMenuInput';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuMenuInput object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'branch_id';
    yield serializers.serialize(
      object.branchId,
      specifiedType: const FullType(String),
    );
    yield r'categories';
    yield serializers.serialize(
      object.categories,
      specifiedType:
          const FullType(BuiltList, [FullType(EmenuMenuCategoryInput)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuMenuInput object, {
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
    required EmenuMenuInputBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'branch_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.branchId = valueDes;
          break;
        case r'categories':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType(BuiltList, [FullType(EmenuMenuCategoryInput)]),
          ) as BuiltList<EmenuMenuCategoryInput>;
          result.categories.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuMenuInput deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuMenuInputBuilder();
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
