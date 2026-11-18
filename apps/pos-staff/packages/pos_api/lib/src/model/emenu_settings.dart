//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'emenu_settings.g.dart';

/// EmenuSettings
///
/// Properties:
/// * [brandColor]
/// * [textColor]
/// * [buttonColor]
/// * [bannerEnabled]
/// * [bannerPromotionIds]
/// * [bestSellersEnabled]
/// * [bestSellersSource]
/// * [bestSellerItemIds]
/// * [bestSellersLimit]
/// * [bestSellersAutoIds]
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
/// * [logoUrl]
/// * [storeName]
/// * [vietqrTimeoutMinutes]
/// * [vietqrAvailable]
@BuiltValue()
abstract class EmenuSettings
    implements Built<EmenuSettings, EmenuSettingsBuilder> {
  @BuiltValueField(wireName: r'brand_color')
  String get brandColor;

  @BuiltValueField(wireName: r'text_color')
  String get textColor;

  @BuiltValueField(wireName: r'button_color')
  String get buttonColor;

  @BuiltValueField(wireName: r'banner_enabled')
  bool get bannerEnabled;

  @BuiltValueField(wireName: r'banner_promotion_ids')
  BuiltList<String> get bannerPromotionIds;

  @BuiltValueField(wireName: r'best_sellers_enabled')
  bool get bestSellersEnabled;

  @BuiltValueField(wireName: r'best_sellers_source')
  EmenuSettingsBestSellersSourceEnum get bestSellersSource;
  // enum bestSellersSourceEnum {  manual,  auto,  };

  @BuiltValueField(wireName: r'best_seller_item_ids')
  BuiltList<String> get bestSellerItemIds;

  @BuiltValueField(wireName: r'best_sellers_limit')
  int get bestSellersLimit;

  @BuiltValueField(wireName: r'best_sellers_auto_ids')
  BuiltList<String> get bestSellersAutoIds;

  @BuiltValueField(wireName: r'new_items_enabled')
  bool get newItemsEnabled;

  @BuiltValueField(wireName: r'new_item_ids')
  BuiltList<String> get newItemIds;

  @BuiltValueField(wireName: r'min_order_interval_seconds')
  int get minOrderIntervalSeconds;

  @BuiltValueField(wireName: r'paused')
  bool get paused;

  @BuiltValueField(wireName: r'payment_timing')
  EmenuSettingsPaymentTimingEnum get paymentTiming;
  // enum paymentTimingEnum {  pay_after,  pay_before,  };

  @BuiltValueField(wireName: r'pay_methods')
  BuiltList<EmenuSettingsPayMethodsEnum> get payMethods;
  // enum payMethodsEnum {  vietqr,  counter,  };

  @BuiltValueField(wireName: r'prepay_timeout_minutes')
  int get prepayTimeoutMinutes;

  @BuiltValueField(wireName: r'sticker_show_logo')
  bool get stickerShowLogo;

  @BuiltValueField(wireName: r'sticker_show_name')
  bool get stickerShowName;

  @BuiltValueField(wireName: r'sticker_store_name')
  String get stickerStoreName;

  @BuiltValueField(wireName: r'sticker_wifi_enabled')
  bool get stickerWifiEnabled;

  @BuiltValueField(wireName: r'sticker_wifi_name')
  String get stickerWifiName;

  @BuiltValueField(wireName: r'sticker_wifi_password')
  String get stickerWifiPassword;

  @BuiltValueField(wireName: r'sticker_greeting')
  String get stickerGreeting;

  @BuiltValueField(wireName: r'sticker_size')
  EmenuSettingsStickerSizeEnum get stickerSize;
  // enum stickerSizeEnum {  60,  80,  100,  custom,  };

  @BuiltValueField(wireName: r'sticker_custom_mm')
  int get stickerCustomMm;

  @BuiltValueField(wireName: r'logo_url')
  String? get logoUrl;

  @BuiltValueField(wireName: r'store_name')
  String get storeName;

  @BuiltValueField(wireName: r'vietqr_timeout_minutes')
  int get vietqrTimeoutMinutes;

  @BuiltValueField(wireName: r'vietqr_available')
  bool get vietqrAvailable;

  EmenuSettings._();

  factory EmenuSettings([void updates(EmenuSettingsBuilder b)]) =
      _$EmenuSettings;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EmenuSettingsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EmenuSettings> get serializer =>
      _$EmenuSettingsSerializer();
}

class _$EmenuSettingsSerializer implements PrimitiveSerializer<EmenuSettings> {
  @override
  final Iterable<Type> types = const [EmenuSettings, _$EmenuSettings];

  @override
  final String wireName = r'EmenuSettings';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EmenuSettings object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'brand_color';
    yield serializers.serialize(
      object.brandColor,
      specifiedType: const FullType(String),
    );
    yield r'text_color';
    yield serializers.serialize(
      object.textColor,
      specifiedType: const FullType(String),
    );
    yield r'button_color';
    yield serializers.serialize(
      object.buttonColor,
      specifiedType: const FullType(String),
    );
    yield r'banner_enabled';
    yield serializers.serialize(
      object.bannerEnabled,
      specifiedType: const FullType(bool),
    );
    yield r'banner_promotion_ids';
    yield serializers.serialize(
      object.bannerPromotionIds,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'best_sellers_enabled';
    yield serializers.serialize(
      object.bestSellersEnabled,
      specifiedType: const FullType(bool),
    );
    yield r'best_sellers_source';
    yield serializers.serialize(
      object.bestSellersSource,
      specifiedType: const FullType(EmenuSettingsBestSellersSourceEnum),
    );
    yield r'best_seller_item_ids';
    yield serializers.serialize(
      object.bestSellerItemIds,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'best_sellers_limit';
    yield serializers.serialize(
      object.bestSellersLimit,
      specifiedType: const FullType(int),
    );
    yield r'best_sellers_auto_ids';
    yield serializers.serialize(
      object.bestSellersAutoIds,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'new_items_enabled';
    yield serializers.serialize(
      object.newItemsEnabled,
      specifiedType: const FullType(bool),
    );
    yield r'new_item_ids';
    yield serializers.serialize(
      object.newItemIds,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'min_order_interval_seconds';
    yield serializers.serialize(
      object.minOrderIntervalSeconds,
      specifiedType: const FullType(int),
    );
    yield r'paused';
    yield serializers.serialize(
      object.paused,
      specifiedType: const FullType(bool),
    );
    yield r'payment_timing';
    yield serializers.serialize(
      object.paymentTiming,
      specifiedType: const FullType(EmenuSettingsPaymentTimingEnum),
    );
    yield r'pay_methods';
    yield serializers.serialize(
      object.payMethods,
      specifiedType:
          const FullType(BuiltList, [FullType(EmenuSettingsPayMethodsEnum)]),
    );
    yield r'prepay_timeout_minutes';
    yield serializers.serialize(
      object.prepayTimeoutMinutes,
      specifiedType: const FullType(int),
    );
    yield r'sticker_show_logo';
    yield serializers.serialize(
      object.stickerShowLogo,
      specifiedType: const FullType(bool),
    );
    yield r'sticker_show_name';
    yield serializers.serialize(
      object.stickerShowName,
      specifiedType: const FullType(bool),
    );
    yield r'sticker_store_name';
    yield serializers.serialize(
      object.stickerStoreName,
      specifiedType: const FullType(String),
    );
    yield r'sticker_wifi_enabled';
    yield serializers.serialize(
      object.stickerWifiEnabled,
      specifiedType: const FullType(bool),
    );
    yield r'sticker_wifi_name';
    yield serializers.serialize(
      object.stickerWifiName,
      specifiedType: const FullType(String),
    );
    yield r'sticker_wifi_password';
    yield serializers.serialize(
      object.stickerWifiPassword,
      specifiedType: const FullType(String),
    );
    yield r'sticker_greeting';
    yield serializers.serialize(
      object.stickerGreeting,
      specifiedType: const FullType(String),
    );
    yield r'sticker_size';
    yield serializers.serialize(
      object.stickerSize,
      specifiedType: const FullType(EmenuSettingsStickerSizeEnum),
    );
    yield r'sticker_custom_mm';
    yield serializers.serialize(
      object.stickerCustomMm,
      specifiedType: const FullType(int),
    );
    yield r'logo_url';
    yield object.logoUrl == null
        ? null
        : serializers.serialize(
            object.logoUrl,
            specifiedType: const FullType.nullable(String),
          );
    yield r'store_name';
    yield serializers.serialize(
      object.storeName,
      specifiedType: const FullType(String),
    );
    yield r'vietqr_timeout_minutes';
    yield serializers.serialize(
      object.vietqrTimeoutMinutes,
      specifiedType: const FullType(int),
    );
    yield r'vietqr_available';
    yield serializers.serialize(
      object.vietqrAvailable,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EmenuSettings object, {
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
    required EmenuSettingsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'brand_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.brandColor = valueDes;
          break;
        case r'text_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.textColor = valueDes;
          break;
        case r'button_color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.buttonColor = valueDes;
          break;
        case r'banner_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.bannerEnabled = valueDes;
          break;
        case r'banner_promotion_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.bannerPromotionIds.replace(valueDes);
          break;
        case r'best_sellers_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.bestSellersEnabled = valueDes;
          break;
        case r'best_sellers_source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(EmenuSettingsBestSellersSourceEnum),
          ) as EmenuSettingsBestSellersSourceEnum;
          result.bestSellersSource = valueDes;
          break;
        case r'best_seller_item_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.bestSellerItemIds.replace(valueDes);
          break;
        case r'best_sellers_limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.bestSellersLimit = valueDes;
          break;
        case r'best_sellers_auto_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.bestSellersAutoIds.replace(valueDes);
          break;
        case r'new_items_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.newItemsEnabled = valueDes;
          break;
        case r'new_item_ids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.newItemIds.replace(valueDes);
          break;
        case r'min_order_interval_seconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.minOrderIntervalSeconds = valueDes;
          break;
        case r'paused':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.paused = valueDes;
          break;
        case r'payment_timing':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(EmenuSettingsPaymentTimingEnum),
          ) as EmenuSettingsPaymentTimingEnum;
          result.paymentTiming = valueDes;
          break;
        case r'pay_methods':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(
                BuiltList, [FullType(EmenuSettingsPayMethodsEnum)]),
          ) as BuiltList<EmenuSettingsPayMethodsEnum>;
          result.payMethods.replace(valueDes);
          break;
        case r'prepay_timeout_minutes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.prepayTimeoutMinutes = valueDes;
          break;
        case r'sticker_show_logo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.stickerShowLogo = valueDes;
          break;
        case r'sticker_show_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.stickerShowName = valueDes;
          break;
        case r'sticker_store_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.stickerStoreName = valueDes;
          break;
        case r'sticker_wifi_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.stickerWifiEnabled = valueDes;
          break;
        case r'sticker_wifi_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.stickerWifiName = valueDes;
          break;
        case r'sticker_wifi_password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.stickerWifiPassword = valueDes;
          break;
        case r'sticker_greeting':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.stickerGreeting = valueDes;
          break;
        case r'sticker_size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(EmenuSettingsStickerSizeEnum),
          ) as EmenuSettingsStickerSizeEnum;
          result.stickerSize = valueDes;
          break;
        case r'sticker_custom_mm':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.stickerCustomMm = valueDes;
          break;
        case r'logo_url':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.logoUrl = valueDes;
          break;
        case r'store_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.storeName = valueDes;
          break;
        case r'vietqr_timeout_minutes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.vietqrTimeoutMinutes = valueDes;
          break;
        case r'vietqr_available':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.vietqrAvailable = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EmenuSettings deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EmenuSettingsBuilder();
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

class EmenuSettingsBestSellersSourceEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'manual')
  static const EmenuSettingsBestSellersSourceEnum manual =
      _$emenuSettingsBestSellersSourceEnum_manual;
  @BuiltValueEnumConst(wireName: r'auto')
  static const EmenuSettingsBestSellersSourceEnum auto =
      _$emenuSettingsBestSellersSourceEnum_auto;

  static Serializer<EmenuSettingsBestSellersSourceEnum> get serializer =>
      _$emenuSettingsBestSellersSourceEnumSerializer;

  const EmenuSettingsBestSellersSourceEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsBestSellersSourceEnum> get values =>
      _$emenuSettingsBestSellersSourceEnumValues;
  static EmenuSettingsBestSellersSourceEnum valueOf(String name) =>
      _$emenuSettingsBestSellersSourceEnumValueOf(name);
}

class EmenuSettingsPaymentTimingEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'pay_after')
  static const EmenuSettingsPaymentTimingEnum payAfter =
      _$emenuSettingsPaymentTimingEnum_payAfter;
  @BuiltValueEnumConst(wireName: r'pay_before')
  static const EmenuSettingsPaymentTimingEnum payBefore =
      _$emenuSettingsPaymentTimingEnum_payBefore;

  static Serializer<EmenuSettingsPaymentTimingEnum> get serializer =>
      _$emenuSettingsPaymentTimingEnumSerializer;

  const EmenuSettingsPaymentTimingEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsPaymentTimingEnum> get values =>
      _$emenuSettingsPaymentTimingEnumValues;
  static EmenuSettingsPaymentTimingEnum valueOf(String name) =>
      _$emenuSettingsPaymentTimingEnumValueOf(name);
}

class EmenuSettingsPayMethodsEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'vietqr')
  static const EmenuSettingsPayMethodsEnum vietqr =
      _$emenuSettingsPayMethodsEnum_vietqr;
  @BuiltValueEnumConst(wireName: r'counter')
  static const EmenuSettingsPayMethodsEnum counter =
      _$emenuSettingsPayMethodsEnum_counter;

  static Serializer<EmenuSettingsPayMethodsEnum> get serializer =>
      _$emenuSettingsPayMethodsEnumSerializer;

  const EmenuSettingsPayMethodsEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsPayMethodsEnum> get values =>
      _$emenuSettingsPayMethodsEnumValues;
  static EmenuSettingsPayMethodsEnum valueOf(String name) =>
      _$emenuSettingsPayMethodsEnumValueOf(name);
}

class EmenuSettingsStickerSizeEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'60')
  static const EmenuSettingsStickerSizeEnum n60 =
      _$emenuSettingsStickerSizeEnum_n60;
  @BuiltValueEnumConst(wireName: r'80')
  static const EmenuSettingsStickerSizeEnum n80 =
      _$emenuSettingsStickerSizeEnum_n80;
  @BuiltValueEnumConst(wireName: r'100')
  static const EmenuSettingsStickerSizeEnum n100 =
      _$emenuSettingsStickerSizeEnum_n100;
  @BuiltValueEnumConst(wireName: r'custom')
  static const EmenuSettingsStickerSizeEnum custom =
      _$emenuSettingsStickerSizeEnum_custom;

  static Serializer<EmenuSettingsStickerSizeEnum> get serializer =>
      _$emenuSettingsStickerSizeEnumSerializer;

  const EmenuSettingsStickerSizeEnum._(String name) : super(name);

  static BuiltSet<EmenuSettingsStickerSizeEnum> get values =>
      _$emenuSettingsStickerSizeEnumValues;
  static EmenuSettingsStickerSizeEnum valueOf(String name) =>
      _$emenuSettingsStickerSizeEnumValueOf(name);
}
