//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_settings_input.g.dart';

/// EmenuSettingsInput
///
/// Properties:
/// * [branchId]
/// * [brandColor]
/// * [textColor]
/// * [buttonColor]
/// * [bannerEnabled]
/// * [bannerPromotionIds]
/// * [bestSellersEnabled]
/// * [bestSellersSource]
/// * [bestSellerItemIds]
/// * [bestSellersLimit]
/// * [newItemsEnabled]
/// * [newItemIds]
/// * [minOrderIntervalSeconds]
/// * [paused]
/// * [paymentTiming]
/// * [payMethods]
/// * [prepayTimeoutMinutes]
/// * [stickerShowLogo]
/// * [stickerShowName]
/// * [stickerStoreName]
/// * [stickerWifiEnabled]
/// * [stickerWifiName]
/// * [stickerWifiPassword]
/// * [stickerGreeting]
/// * [stickerSize]
/// * [stickerCustomMm]
@BuiltValue()
abstract class EmenuSettingsInput
    implements Built<EmenuSettingsInput, EmenuSettingsInputBuilder> {
  @BuiltValueField(wireName: r'branch_id')
  String get branchId;

  @BuiltValueField(wireName: r'brand_color')
  String? get brandColor;

  @BuiltValueField(wireName: r'text_color')
  String? get textColor;

  @BuiltValueField(wireName: r'button_color')
  String? get buttonColor;

  @BuiltValueField(wireName: r'banner_enabled')
  bool? get bannerEnabled;

  @BuiltValueField(wireName: r'banner_promotion_ids')
  BuiltList<String>? get bannerPromotionIds;

  @BuiltValueField(wireName: r'best_sellers_enabled')
  bool? get bestSellersEnabled;

  @BuiltValueField(wireName: r'best_sellers_source')
  EmenuSettingsInputBestSellersSourceEnum? get bestSellersSource;
  // enum bestSellersSourceEnum {  manual,  auto,  };

  @BuiltValueField(wireName: r'best_seller_item_ids')
  BuiltList<String>? get bestSellerItemIds;

  @BuiltValueField(wireName: r'best_sellers_limit')
  int? get bestSellersLimit;

  @BuiltValueField(wireName: r'new_items_enabled')
  bool? get newItemsEnabled;

  @BuiltValueField(wireName: r'new_item_ids')
  BuiltList<String>? get newItemIds;

  @BuiltValueField(wireName: r'min_order_interval_seconds')
  int? get minOrderIntervalSeconds;

  @BuiltValueField(wireName: r'paused')
  bool? get paused;

  @BuiltValueField(wireName: r'payment_timing')
  EmenuSettingsInputPaymentTimingEnum? get paymentTiming;
  // enum paymentTimingEnum {  pay_after,  pay_before,  };

  @BuiltValueField(wireName: r'pay_methods')
  BuiltList<EmenuSettingsInputPayMethodsEnum>? get payMethods;
  // enum payMethodsEnum {  vietqr,  counter,  };

  @BuiltValueField(wireName: r'prepay_timeout_minutes')
  int? get prepayTimeoutMinutes;

  @BuiltValueField(wireName: r'sticker_show_logo')
  bool? get stickerShowLogo;

  @BuiltValueField(wireName: r'sticker_show_name')
  bool? get stickerShowName;

  @BuiltValueField(wireName: r'sticker_store_name')
  String? get stickerStoreName;

  @BuiltValueField(wireName: r'sticker_wifi_enabled')
  bool? get stickerWifiEnabled;

  @BuiltValueField(wireName: r'sticker_wifi_name')
  String? get stickerWifiName;

  @BuiltValueField(wireName: r'sticker_wifi_password')
  String? get stickerWifiPassword;

  @BuiltValueField(wireName: r'sticker_greeting')
  String? get stickerGreeting;

  @BuiltValueField(wireName: r'sticker_size')
  EmenuSettingsInputStickerSizeEnum? get stickerSize;
  // enum stickerSizeEnum {  60,  80,  100,  custom,  };

  @BuiltValueField(wireName: r'sticker_custom_mm')
  int? get stickerCustomMm;

  EmenuSettingsInput._();

  factory EmenuSettingsInput([void updates(EmenuSettingsInputBuilder b)]) =
      _$EmenuSettingsInput;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuSettingsInputBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuSettingsInput> get serializer =>
      _$EmenuSettingsInputSerializer();
}

class _$EmenuSettingsInputSerializer
    implements PrimitiveSerializer<EmenuSettingsInput> {
  @override
  final Iterable<Type> types = const [EmenuSettingsInput, _$EmenuSettingsInput];

  @override
  final String wireName = r'EmenuSettingsInput';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuSettingsInput object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'branch_id';
    yield serializers.serialize(
      object.branchId,
      specifiedType: const FullType(String),
    );
    if (object.brandColor != null) {
      yield r'brand_color';
      yield serializers.serialize(
        object.brandColor,
        specifiedType: const FullType(String),
      );
    }
    if (object.textColor != null) {
      yield r'text_color';
      yield serializers.serialize(
        object.textColor,
        specifiedType: const FullType(String),
      );
    }
    if (object.buttonColor != null) {
      yield r'button_color';
      yield serializers.serialize(
        object.buttonColor,
        specifiedType: const FullType(String),
      );
    }
    if (object.bannerEnabled != null) {
      yield r'banner_enabled';
      yield serializers.serialize(
        object.bannerEnabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.bannerPromotionIds != null) {
      yield r'banner_promotion_ids';
      yield serializers.serialize(
        object.bannerPromotionIds,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.bestSellersEnabled != null) {
      yield r'best_sellers_enabled';
      yield serializers.serialize(
        object.bestSellersEnabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.bestSellersSource != null) {
      yield r'best_sellers_source';
      yield serializers.serialize(
        object.bestSellersSource,
        specifiedType: const FullType(EmenuSettingsInputBestSellersSourceEnum),
      );
    }
    if (object.bestSellerItemIds != null) {
      yield r'best_seller_item_ids';
      yield serializers.serialize(
        object.bestSellerItemIds,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.bestSellersLimit != null) {
      yield r'best_sellers_limit';
      yield serializers.serialize(
        object.bestSellersLimit,
        specifiedType: const FullType(int),
      );
    }
    if (object.newItemsEnabled != null) {
      yield r'new_items_enabled';
      yield serializers.serialize(
        object.newItemsEnabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.newItemIds != null) {
      yield r'new_item_ids';
      yield serializers.serialize(
        object.newItemIds,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.minOrderIntervalSeconds != null) {
      yield r'min_order_interval_seconds';
      yield serializers.serialize(
        object.minOrderIntervalSeconds,
        specifiedType: const FullType(int),
      );
    }
    if (object.paused != null) {
      yield r'paused';
      yield serializers.serialize(
        object.paused,
        specifiedType: const FullType(bool),
      );
    }
    if (object.paymentTiming != null) {
      yield r'payment_timing';
      yield serializers.serialize(
        object.paymentTiming,
        specifiedType: const FullType(EmenuSettingsInputPaymentTimingEnum),
      );
    }
    if (object.payMethods != null) {
      yield r'pay_methods';
      yield serializers.serialize(
        object.payMethods,
        specifiedType: const FullType(
            BuiltList, [FullType(EmenuSettingsInputPayMethodsEnum)]),
      );
    }
    if (object.prepayTimeoutMinutes != null) {
      yield r'prepay_timeout_minutes';
      yield serializers.serialize(
        object.prepayTimeoutMinutes,
        specifiedType: const FullType(int),
      );
    }
    if (object.stickerShowLogo != null) {
      yield r'sticker_show_logo';
      yield serializers.serialize(
        object.stickerShowLogo,
        specifiedType: const FullType(bool),
      );
    }
    if (object.stickerShowName != null) {
      yield r'sticker_show_name';
      yield serializers.serialize(
        object.stickerShowName,
        specifiedType: const FullType(bool),
      );
    }
    if (object.stickerStoreName != null) {
      yield r'sticker_store_name';
      yield serializers.serialize(
        object.stickerStoreName,
        specifiedType: const FullType(String),
      );
    }
    if (object.stickerWifiEnabled != null) {
      yield r'sticker_wifi_enabled';
      yield serializers.serialize(
        object.stickerWifiEnabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.stickerWifiName != null) {
      yield r'sticker_wifi_name';
      yield serializers.serialize(
        object.stickerWifiName,
        specifiedType: const FullType(String),
      );
    }
    if (object.stickerWifiPassword != null) {
      yield r'sticker_wifi_password';
      yield serializers.serialize(
        object.stickerWifiPassword,
        specifiedType: const FullType(String),
      );
    }
    if (object.stickerGreeting != null) {
      yield r'sticker_greeting';
      yield serializers.serialize(
        object.stickerGreeting,
        specifiedType: const FullType(String),
      );
    }
    if (object.stickerSize != null) {
      yield r'sticker_size';
      yield serializers.serialize(
        object.stickerSize,
        specifiedType: const FullType(EmenuSettingsInputStickerSizeEnum),
      );
    }
    if (object.stickerCustomMm != null) {
      yield r'sticker_custom_mm';
      yield serializers.serialize(
        object.stickerCustomMm,
        specifiedType: const FullType(int),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuSettingsInput object, {
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
    required EmenuSettingsInputBuilder result,
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
        case r'brand_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.brandColor = valueDes;
          break;
        case r'text_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.textColor = valueDes;
          break;
        case r'button_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.buttonColor = valueDes;
          break;
        case r'banner_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.bannerEnabled = valueDes;
          break;
        case r'banner_promotion_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(BuiltList, [FullType(String)]),
          ) as BuiltList<String>?;
          if (valueDes == null) continue;
          result.bannerPromotionIds.replace(valueDes);
          break;
        case r'best_sellers_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.bestSellersEnabled = valueDes;
          break;
        case r'best_sellers_source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(
                EmenuSettingsInputBestSellersSourceEnum),
          ) as EmenuSettingsInputBestSellersSourceEnum?;
          if (valueDes == null) continue;
          result.bestSellersSource = valueDes;
          break;
        case r'best_seller_item_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(BuiltList, [FullType(String)]),
          ) as BuiltList<String>?;
          if (valueDes == null) continue;
          result.bestSellerItemIds.replace(valueDes);
          break;
        case r'best_sellers_limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.bestSellersLimit = valueDes;
          break;
        case r'new_items_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.newItemsEnabled = valueDes;
          break;
        case r'new_item_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(BuiltList, [FullType(String)]),
          ) as BuiltList<String>?;
          if (valueDes == null) continue;
          result.newItemIds.replace(valueDes);
          break;
        case r'min_order_interval_seconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.minOrderIntervalSeconds = valueDes;
          break;
        case r'paused':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.paused = valueDes;
          break;
        case r'payment_timing':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(EmenuSettingsInputPaymentTimingEnum),
          ) as EmenuSettingsInputPaymentTimingEnum?;
          if (valueDes == null) continue;
          result.paymentTiming = valueDes;
          break;
        case r'pay_methods':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(
                BuiltList, [FullType(EmenuSettingsInputPayMethodsEnum)]),
          ) as BuiltList<EmenuSettingsInputPayMethodsEnum>?;
          if (valueDes == null) continue;
          result.payMethods.replace(valueDes);
          break;
        case r'prepay_timeout_minutes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.prepayTimeoutMinutes = valueDes;
          break;
        case r'sticker_show_logo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.stickerShowLogo = valueDes;
          break;
        case r'sticker_show_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.stickerShowName = valueDes;
          break;
        case r'sticker_store_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.stickerStoreName = valueDes;
          break;
        case r'sticker_wifi_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.stickerWifiEnabled = valueDes;
          break;
        case r'sticker_wifi_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.stickerWifiName = valueDes;
          break;
        case r'sticker_wifi_password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.stickerWifiPassword = valueDes;
          break;
        case r'sticker_greeting':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.stickerGreeting = valueDes;
          break;
        case r'sticker_size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(EmenuSettingsInputStickerSizeEnum),
          ) as EmenuSettingsInputStickerSizeEnum?;
          if (valueDes == null) continue;
          result.stickerSize = valueDes;
          break;
        case r'sticker_custom_mm':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.stickerCustomMm = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuSettingsInput deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuSettingsInputBuilder();
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

class EmenuSettingsInputBestSellersSourceEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'manual')
  static const EmenuSettingsInputBestSellersSourceEnum manual =
      _$emenuSettingsInputBestSellersSourceEnum_manual;
  @BuiltValueEnumConst(wireName: r'auto')
  static const EmenuSettingsInputBestSellersSourceEnum auto =
      _$emenuSettingsInputBestSellersSourceEnum_auto;

  static Serializer<EmenuSettingsInputBestSellersSourceEnum> get serializer =>
      _$emenuSettingsInputBestSellersSourceEnumSerializer;

  const EmenuSettingsInputBestSellersSourceEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsInputBestSellersSourceEnum> get values =>
      _$emenuSettingsInputBestSellersSourceEnumValues;
  static EmenuSettingsInputBestSellersSourceEnum valueOf(String name) =>
      _$emenuSettingsInputBestSellersSourceEnumValueOf(name);
}

class EmenuSettingsInputPaymentTimingEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'pay_after')
  static const EmenuSettingsInputPaymentTimingEnum payAfter =
      _$emenuSettingsInputPaymentTimingEnum_payAfter;
  @BuiltValueEnumConst(wireName: r'pay_before')
  static const EmenuSettingsInputPaymentTimingEnum payBefore =
      _$emenuSettingsInputPaymentTimingEnum_payBefore;

  static Serializer<EmenuSettingsInputPaymentTimingEnum> get serializer =>
      _$emenuSettingsInputPaymentTimingEnumSerializer;

  const EmenuSettingsInputPaymentTimingEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsInputPaymentTimingEnum> get values =>
      _$emenuSettingsInputPaymentTimingEnumValues;
  static EmenuSettingsInputPaymentTimingEnum valueOf(String name) =>
      _$emenuSettingsInputPaymentTimingEnumValueOf(name);
}

class EmenuSettingsInputPayMethodsEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'vietqr')
  static const EmenuSettingsInputPayMethodsEnum vietqr =
      _$emenuSettingsInputPayMethodsEnum_vietqr;
  @BuiltValueEnumConst(wireName: r'counter')
  static const EmenuSettingsInputPayMethodsEnum counter =
      _$emenuSettingsInputPayMethodsEnum_counter;

  static Serializer<EmenuSettingsInputPayMethodsEnum> get serializer =>
      _$emenuSettingsInputPayMethodsEnumSerializer;

  const EmenuSettingsInputPayMethodsEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsInputPayMethodsEnum> get values =>
      _$emenuSettingsInputPayMethodsEnumValues;
  static EmenuSettingsInputPayMethodsEnum valueOf(String name) =>
      _$emenuSettingsInputPayMethodsEnumValueOf(name);
}

class EmenuSettingsInputStickerSizeEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'60')
  static const EmenuSettingsInputStickerSizeEnum n60 =
      _$emenuSettingsInputStickerSizeEnum_n60;
  @BuiltValueEnumConst(wireName: r'80')
  static const EmenuSettingsInputStickerSizeEnum n80 =
      _$emenuSettingsInputStickerSizeEnum_n80;
  @BuiltValueEnumConst(wireName: r'100')
  static const EmenuSettingsInputStickerSizeEnum n100 =
      _$emenuSettingsInputStickerSizeEnum_n100;
  @BuiltValueEnumConst(wireName: r'custom')
  static const EmenuSettingsInputStickerSizeEnum custom =
      _$emenuSettingsInputStickerSizeEnum_custom;

  static Serializer<EmenuSettingsInputStickerSizeEnum> get serializer =>
      _$emenuSettingsInputStickerSizeEnumSerializer;

  const EmenuSettingsInputStickerSizeEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsInputStickerSizeEnum> get values =>
      _$emenuSettingsInputStickerSizeEnumValues;
  static EmenuSettingsInputStickerSizeEnum valueOf(String name) =>
      _$emenuSettingsInputStickerSizeEnumValueOf(name);
}
