//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'dashboard_layout_item.g.dart';

/// DashboardLayoutItem
///
/// Properties:
/// * [id]
/// * [widget]
/// * [x]
/// * [y]
/// * [w]
/// * [h]
/// * [options] - Widget settings, such as the selected tab; under 2 KB as JSON.
@BuiltValue()
abstract class DashboardLayoutItem
    implements Built<DashboardLayoutItem, DashboardLayoutItemBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'widget')
  String get widget;

  @BuiltValueField(wireName: r'x')
  int get x;

  @BuiltValueField(wireName: r'y')
  int get y;

  @BuiltValueField(wireName: r'w')
  int get w;

  @BuiltValueField(wireName: r'h')
  int get h;

  /// Widget settings, such as the selected tab; under 2 KB as JSON.
  @BuiltValueField(wireName: r'options')
  BuiltMap<String, JsonObject?>? get options;

  DashboardLayoutItem._();

  factory DashboardLayoutItem([void updates(DashboardLayoutItemBuilder b)]) =
      _$DashboardLayoutItem;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DashboardLayoutItemBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DashboardLayoutItem> get serializer =>
      _$DashboardLayoutItemSerializer();
}

class _$DashboardLayoutItemSerializer
    implements PrimitiveSerializer<DashboardLayoutItem> {
  @override
  final Iterable<Type> types = const [
    DashboardLayoutItem,
    _$DashboardLayoutItem
  ];

  @override
  final String wireName = r'DashboardLayoutItem';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DashboardLayoutItem object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'widget';
    yield serializers.serialize(
      object.widget,
      specifiedType: const FullType(String),
    );
    yield r'x';
    yield serializers.serialize(
      object.x,
      specifiedType: const FullType(int),
    );
    yield r'y';
    yield serializers.serialize(
      object.y,
      specifiedType: const FullType(int),
    );
    yield r'w';
    yield serializers.serialize(
      object.w,
      specifiedType: const FullType(int),
    );
    yield r'h';
    yield serializers.serialize(
      object.h,
      specifiedType: const FullType(int),
    );
    if (object.options != null) {
      yield r'options';
      yield serializers.serialize(
        object.options,
        specifiedType: const FullType(
            BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    DashboardLayoutItem object, {
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
    required DashboardLayoutItemBuilder result,
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
        case r'widget':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.widget = valueDes;
          break;
        case r'x':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.x = valueDes;
          break;
        case r'y':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.y = valueDes;
          break;
        case r'w':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.w = valueDes;
          break;
        case r'h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.h = valueDes;
          break;
        case r'options':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(
                BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.options.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DashboardLayoutItem deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DashboardLayoutItemBuilder();
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
