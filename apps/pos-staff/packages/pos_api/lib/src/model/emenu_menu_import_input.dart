//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_menu_import_input.g.dart';

/// EmenuMenuImportInput
///
/// Properties:
/// * [branchId]
@BuiltValue()
abstract class EmenuMenuImportInput
    implements Built<EmenuMenuImportInput, EmenuMenuImportInputBuilder> {
  @BuiltValueField(wireName: r'branch_id')
  String get branchId;

  EmenuMenuImportInput._();

  factory EmenuMenuImportInput([void updates(EmenuMenuImportInputBuilder b)]) =
      _$EmenuMenuImportInput;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuMenuImportInputBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuMenuImportInput> get serializer =>
      _$EmenuMenuImportInputSerializer();
}

class _$EmenuMenuImportInputSerializer
    implements PrimitiveSerializer<EmenuMenuImportInput> {
  @override
  final Iterable<Type> types = const [
    EmenuMenuImportInput,
    _$EmenuMenuImportInput
  ];

  @override
  final String wireName = r'EmenuMenuImportInput';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuMenuImportInput object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'branch_id';
    yield serializers.serialize(
      object.branchId,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuMenuImportInput object, {
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
    required EmenuMenuImportInputBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuMenuImportInput deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuMenuImportInputBuilder();
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
