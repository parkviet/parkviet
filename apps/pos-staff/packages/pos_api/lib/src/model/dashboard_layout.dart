//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:pos_api/src/model/dashboard_layout_item.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'dashboard_layout.g.dart';

/// DashboardLayout
///
/// Properties:
/// * [layout]
/// * [version] - Layout format version.
/// * [updatedAt]
@BuiltValue()
abstract class DashboardLayout
    implements Built<DashboardLayout, DashboardLayoutBuilder> {
  @BuiltValueField(wireName: r'layout')
  BuiltList<DashboardLayoutItem> get layout;

  /// Layout format version.
  @BuiltValueField(wireName: r'version')
  int get version;

  @BuiltValueField(wireName: r'updated_at')
  DateTime get updatedAt;

  DashboardLayout._();

  factory DashboardLayout([void updates(DashboardLayoutBuilder b)]) =
      _$DashboardLayout;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DashboardLayoutBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DashboardLayout> get serializer =>
      _$DashboardLayoutSerializer();
}

class _$DashboardLayoutSerializer
    implements PrimitiveSerializer<DashboardLayout> {
  @override
  final Iterable<Type> types = const [DashboardLayout, _$DashboardLayout];

  @override
  final String wireName = r'DashboardLayout';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DashboardLayout object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'layout';
    yield serializers.serialize(
      object.layout,
      specifiedType: const FullType(BuiltList, [FullType(DashboardLayoutItem)]),
    );
    yield r'version';
    yield serializers.serialize(
      object.version,
      specifiedType: const FullType(int),
    );
    yield r'updated_at';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    DashboardLayout object, {
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
    required DashboardLayoutBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'layout':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType(BuiltList, [FullType(DashboardLayoutItem)]),
          ) as BuiltList<DashboardLayoutItem>;
          result.layout.replace(valueDes);
          break;
        case r'version':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.version = valueDes;
          break;
        case r'updated_at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DashboardLayout deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DashboardLayoutBuilder();
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
