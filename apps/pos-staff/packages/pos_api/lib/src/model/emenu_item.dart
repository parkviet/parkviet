//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_item.g.dart';

/// EmenuItem
///
/// Properties:
/// * [id]
/// * [menuItemId]
/// * [position]
@BuiltValue()
abstract class EmenuItem implements Built<EmenuItem, EmenuItemBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'menu_item_id')
  String get menuItemId;

  @BuiltValueField(wireName: r'position')
  int get position;

  EmenuItem._();

  factory EmenuItem([void updates(EmenuItemBuilder b)]) = _$EmenuItem;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuItemBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuItem> get serializer => _$EmenuItemSerializer();
}

class _$EmenuItemSerializer implements PrimitiveSerializer<EmenuItem> {
  @override
  final Iterable<Type> types = const [EmenuItem, _$EmenuItem];

  @override
  final String wireName = r'EmenuItem';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuItem object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'menu_item_id';
    yield serializers.serialize(
      object.menuItemId,
      specifiedType: const FullType(String),
    );
    yield r'position';
    yield serializers.serialize(
      object.position,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuItem object, {
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
    required EmenuItemBuilder result,
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
        case r'menu_item_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.menuItemId = valueDes;
          break;
        case r'position':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.position = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuItem deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuItemBuilder();
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
