//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:pos_api/src/model/emenu_item.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_category.g.dart';

/// EmenuCategory
///
/// Properties:
/// * [id]
/// * [name]
/// * [position]
/// * [color]
/// * [imageUrl]
/// * [items]
@BuiltValue()
abstract class EmenuCategory
    implements Built<EmenuCategory, EmenuCategoryBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'position')
  int get position;

  @BuiltValueField(wireName: r'color')
  String? get color;

  @BuiltValueField(wireName: r'image_url')
  String? get imageUrl;

  @BuiltValueField(wireName: r'items')
  BuiltList<EmenuItem> get items;

  EmenuCategory._();

  factory EmenuCategory([void updates(EmenuCategoryBuilder b)]) =
      _$EmenuCategory;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuCategoryBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuCategory> get serializer =>
      _$EmenuCategorySerializer();
}

class _$EmenuCategorySerializer implements PrimitiveSerializer<EmenuCategory> {
  @override
  final Iterable<Type> types = const [EmenuCategory, _$EmenuCategory];

  @override
  final String wireName = r'EmenuCategory';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuCategory object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'position';
    yield serializers.serialize(
      object.position,
      specifiedType: const FullType(int),
    );
    yield r'color';
    yield object.color == null
        ? null
        : serializers.serialize(
            object.color,
            specifiedType: const FullType.nullable(String),
          );
    yield r'image_url';
    yield object.imageUrl == null
        ? null
        : serializers.serialize(
            object.imageUrl,
            specifiedType: const FullType.nullable(String),
          );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(EmenuItem)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuCategory object, {
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
    required EmenuCategoryBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'position':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.position = valueDes;
          break;
        case r'color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.color = valueDes;
          break;
        case r'image_url':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.imageUrl = valueDes;
          break;
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(EmenuItem)]),
          ) as BuiltList<EmenuItem>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuCategory deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuCategoryBuilder();
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
