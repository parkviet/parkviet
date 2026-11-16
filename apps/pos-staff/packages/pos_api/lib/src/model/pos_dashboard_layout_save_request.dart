//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:pos_api/src/model/dashboard_layout_item.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'pos_dashboard_layout_save_request.g.dart';

/// PosDashboardLayoutSaveRequest
///
/// Properties:
/// * [layout]
@BuiltValue()
abstract class PosDashboardLayoutSaveRequest
    implements
        Built<PosDashboardLayoutSaveRequest,
            PosDashboardLayoutSaveRequestBuilder> {
  @BuiltValueField(wireName: r'layout')
  BuiltList<DashboardLayoutItem> get layout;

  PosDashboardLayoutSaveRequest._();

  factory PosDashboardLayoutSaveRequest(
          [void updates(PosDashboardLayoutSaveRequestBuilder b)]) =
      _$PosDashboardLayoutSaveRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PosDashboardLayoutSaveRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PosDashboardLayoutSaveRequest> get serializer =>
      _$PosDashboardLayoutSaveRequestSerializer();
}

class _$PosDashboardLayoutSaveRequestSerializer
    implements PrimitiveSerializer<PosDashboardLayoutSaveRequest> {
  @override
  final Iterable<Type> types = const [
    PosDashboardLayoutSaveRequest,
    _$PosDashboardLayoutSaveRequest
  ];

  @override
  final String wireName = r'PosDashboardLayoutSaveRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PosDashboardLayoutSaveRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'layout';
    yield serializers.serialize(
      object.layout,
      specifiedType: const FullType(BuiltList, [FullType(DashboardLayoutItem)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    PosDashboardLayoutSaveRequest object, {
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
    required PosDashboardLayoutSaveRequestBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  PosDashboardLayoutSaveRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PosDashboardLayoutSaveRequestBuilder();
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
