// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_settings.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const EmenuSettingsBestSellersSourceEnum
    _$emenuSettingsBestSellersSourceEnum_manual =
    const EmenuSettingsBestSellersSourceEnum._('manual');
const EmenuSettingsBestSellersSourceEnum
    _$emenuSettingsBestSellersSourceEnum_auto =
    const EmenuSettingsBestSellersSourceEnum._('auto');

EmenuSettingsBestSellersSourceEnum _$emenuSettingsBestSellersSourceEnumValueOf(
    String name) {
  switch (name) {
    case 'manual':
      return _$emenuSettingsBestSellersSourceEnum_manual;
    case 'auto':
      return _$emenuSettingsBestSellersSourceEnum_auto;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsBestSellersSourceEnum>
    _$emenuSettingsBestSellersSourceEnumValues = BuiltSet<
        EmenuSettingsBestSellersSourceEnum>(const <EmenuSettingsBestSellersSourceEnum>[
  _$emenuSettingsBestSellersSourceEnum_manual,
  _$emenuSettingsBestSellersSourceEnum_auto,
]);

const EmenuSettingsPaymentTimingEnum _$emenuSettingsPaymentTimingEnum_payAfter =
    const EmenuSettingsPaymentTimingEnum._('payAfter');
const EmenuSettingsPaymentTimingEnum
    _$emenuSettingsPaymentTimingEnum_payBefore =
    const EmenuSettingsPaymentTimingEnum._('payBefore');

EmenuSettingsPaymentTimingEnum _$emenuSettingsPaymentTimingEnumValueOf(
    String name) {
  switch (name) {
    case 'payAfter':
      return _$emenuSettingsPaymentTimingEnum_payAfter;
    case 'payBefore':
      return _$emenuSettingsPaymentTimingEnum_payBefore;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsPaymentTimingEnum>
    _$emenuSettingsPaymentTimingEnumValues = BuiltSet<
        EmenuSettingsPaymentTimingEnum>(const <EmenuSettingsPaymentTimingEnum>[
  _$emenuSettingsPaymentTimingEnum_payAfter,
  _$emenuSettingsPaymentTimingEnum_payBefore,
]);

const EmenuSettingsPayMethodsEnum _$emenuSettingsPayMethodsEnum_vietqr =
    const EmenuSettingsPayMethodsEnum._('vietqr');
const EmenuSettingsPayMethodsEnum _$emenuSettingsPayMethodsEnum_counter =
    const EmenuSettingsPayMethodsEnum._('counter');

EmenuSettingsPayMethodsEnum _$emenuSettingsPayMethodsEnumValueOf(String name) {
  switch (name) {
    case 'vietqr':
      return _$emenuSettingsPayMethodsEnum_vietqr;
    case 'counter':
      return _$emenuSettingsPayMethodsEnum_counter;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsPayMethodsEnum>
    _$emenuSettingsPayMethodsEnumValues =
    BuiltSet<EmenuSettingsPayMethodsEnum>(const <EmenuSettingsPayMethodsEnum>[
  _$emenuSettingsPayMethodsEnum_vietqr,
  _$emenuSettingsPayMethodsEnum_counter,
]);

const EmenuSettingsStickerSizeEnum _$emenuSettingsStickerSizeEnum_n60 =
    const EmenuSettingsStickerSizeEnum._('n60');
const EmenuSettingsStickerSizeEnum _$emenuSettingsStickerSizeEnum_n80 =
    const EmenuSettingsStickerSizeEnum._('n80');
const EmenuSettingsStickerSizeEnum _$emenuSettingsStickerSizeEnum_n100 =
    const EmenuSettingsStickerSizeEnum._('n100');
const EmenuSettingsStickerSizeEnum _$emenuSettingsStickerSizeEnum_custom =
    const EmenuSettingsStickerSizeEnum._('custom');

EmenuSettingsStickerSizeEnum _$emenuSettingsStickerSizeEnumValueOf(
    String name) {
  switch (name) {
    case 'n60':
      return _$emenuSettingsStickerSizeEnum_n60;
    case 'n80':
      return _$emenuSettingsStickerSizeEnum_n80;
    case 'n100':
      return _$emenuSettingsStickerSizeEnum_n100;
    case 'custom':
      return _$emenuSettingsStickerSizeEnum_custom;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsStickerSizeEnum>
    _$emenuSettingsStickerSizeEnumValues =
    BuiltSet<EmenuSettingsStickerSizeEnum>(const <EmenuSettingsStickerSizeEnum>[
  _$emenuSettingsStickerSizeEnum_n60,
  _$emenuSettingsStickerSizeEnum_n80,
  _$emenuSettingsStickerSizeEnum_n100,
  _$emenuSettingsStickerSizeEnum_custom,
]);

Serializer<EmenuSettingsBestSellersSourceEnum>
    _$emenuSettingsBestSellersSourceEnumSerializer =
    _$EmenuSettingsBestSellersSourceEnumSerializer();
Serializer<EmenuSettingsPaymentTimingEnum>
    _$emenuSettingsPaymentTimingEnumSerializer =
    _$EmenuSettingsPaymentTimingEnumSerializer();
Serializer<EmenuSettingsPayMethodsEnum>
    _$emenuSettingsPayMethodsEnumSerializer =
    _$EmenuSettingsPayMethodsEnumSerializer();
Serializer<EmenuSettingsStickerSizeEnum>
    _$emenuSettingsStickerSizeEnumSerializer =
    _$EmenuSettingsStickerSizeEnumSerializer();

class _$EmenuSettingsBestSellersSourceEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsBestSellersSourceEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'manual': 'manual',
    'auto': 'auto',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'manual': 'manual',
    'auto': 'auto',
  };

  @override
  final Iterable<Type> types = const <Type>[EmenuSettingsBestSellersSourceEnum];
  @override
  final String wireName = 'EmenuSettingsBestSellersSourceEnum';

  @override
  Object serialize(
          Serializers serializers, EmenuSettingsBestSellersSourceEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsBestSellersSourceEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsBestSellersSourceEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsPaymentTimingEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsPaymentTimingEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'payAfter': 'pay_after',
    'payBefore': 'pay_before',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'pay_after': 'payAfter',
    'pay_before': 'payBefore',
  };

  @override
  final Iterable<Type> types = const <Type>[EmenuSettingsPaymentTimingEnum];
  @override
  final String wireName = 'EmenuSettingsPaymentTimingEnum';

  @override
  Object serialize(
          Serializers serializers, EmenuSettingsPaymentTimingEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsPaymentTimingEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsPaymentTimingEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsPayMethodsEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsPayMethodsEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'vietqr': 'vietqr',
    'counter': 'counter',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'vietqr': 'vietqr',
    'counter': 'counter',
  };

  @override
  final Iterable<Type> types = const <Type>[EmenuSettingsPayMethodsEnum];
  @override
  final String wireName = 'EmenuSettingsPayMethodsEnum';

  @override
  Object serialize(Serializers serializers, EmenuSettingsPayMethodsEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsPayMethodsEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsPayMethodsEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsStickerSizeEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsStickerSizeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n60': '60',
    'n80': '80',
    'n100': '100',
    'custom': 'custom',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '60': 'n60',
    '80': 'n80',
    '100': 'n100',
    'custom': 'custom',
  };

  @override
  final Iterable<Type> types = const <Type>[EmenuSettingsStickerSizeEnum];
  @override
  final String wireName = 'EmenuSettingsStickerSizeEnum';

  @override
  Object serialize(Serializers serializers, EmenuSettingsStickerSizeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsStickerSizeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsStickerSizeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettings extends EmenuSettings {
  @override
  final String brandColor;
  @override
  final String textColor;
  @override
  final String buttonColor;
  @override
  final bool bannerEnabled;
  @override
  final BuiltList<String> bannerPromotionIds;
  @override
  final bool bestSellersEnabled;
  @override
  final EmenuSettingsBestSellersSourceEnum bestSellersSource;
  @override
  final BuiltList<String> bestSellerItemIds;
  @override
  final int bestSellersLimit;
  @override
  final BuiltList<String> bestSellersAutoIds;
  @override
  final bool newItemsEnabled;
  @override
  final BuiltList<String> newItemIds;
  @override
  final int minOrderIntervalSeconds;
  @override
  final bool paused;
  @override
  final EmenuSettingsPaymentTimingEnum paymentTiming;
  @override
  final BuiltList<EmenuSettingsPayMethodsEnum> payMethods;
  @override
  final int prepayTimeoutMinutes;
  @override
  final bool stickerShowLogo;
  @override
  final bool stickerShowName;
  @override
  final String stickerStoreName;
  @override
  final bool stickerWifiEnabled;
  @override
  final String stickerWifiName;
  @override
  final String stickerWifiPassword;
  @override
  final String stickerGreeting;
  @override
  final EmenuSettingsStickerSizeEnum stickerSize;
  @override
  final int stickerCustomMm;
  @override
  final String? logoUrl;
  @override
  final String storeName;
  @override
  final int vietqrTimeoutMinutes;
  @override
  final bool vietqrAvailable;

  factory _$EmenuSettings([void Function(EmenuSettingsBuilder)? updates]) =>
      (EmenuSettingsBuilder()..update(updates))._build();

  _$EmenuSettings._(
      {required this.brandColor,
      required this.textColor,
      required this.buttonColor,
      required this.bannerEnabled,
      required this.bannerPromotionIds,
      required this.bestSellersEnabled,
      required this.bestSellersSource,
      required this.bestSellerItemIds,
      required this.bestSellersLimit,
      required this.bestSellersAutoIds,
      required this.newItemsEnabled,
      required this.newItemIds,
      required this.minOrderIntervalSeconds,
      required this.paused,
      required this.paymentTiming,
      required this.payMethods,
      required this.prepayTimeoutMinutes,
      required this.stickerShowLogo,
      required this.stickerShowName,
      required this.stickerStoreName,
      required this.stickerWifiEnabled,
      required this.stickerWifiName,
      required this.stickerWifiPassword,
      required this.stickerGreeting,
      required this.stickerSize,
      required this.stickerCustomMm,
      this.logoUrl,
      required this.storeName,
      required this.vietqrTimeoutMinutes,
      required this.vietqrAvailable})
      : super._();
  @override
  EmenuSettings rebuild(void Function(EmenuSettingsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuSettingsBuilder toBuilder() => EmenuSettingsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuSettings &&
        brandColor == other.brandColor &&
        textColor == other.textColor &&
        buttonColor == other.buttonColor &&
        bannerEnabled == other.bannerEnabled &&
        bannerPromotionIds == other.bannerPromotionIds &&
        bestSellersEnabled == other.bestSellersEnabled &&
        bestSellersSource == other.bestSellersSource &&
        bestSellerItemIds == other.bestSellerItemIds &&
        bestSellersLimit == other.bestSellersLimit &&
        bestSellersAutoIds == other.bestSellersAutoIds &&
        newItemsEnabled == other.newItemsEnabled &&
        newItemIds == other.newItemIds &&
        minOrderIntervalSeconds == other.minOrderIntervalSeconds &&
        paused == other.paused &&
        paymentTiming == other.paymentTiming &&
        payMethods == other.payMethods &&
        prepayTimeoutMinutes == other.prepayTimeoutMinutes &&
        stickerShowLogo == other.stickerShowLogo &&
        stickerShowName == other.stickerShowName &&
        stickerStoreName == other.stickerStoreName &&
        stickerWifiEnabled == other.stickerWifiEnabled &&
        stickerWifiName == other.stickerWifiName &&
        stickerWifiPassword == other.stickerWifiPassword &&
        stickerGreeting == other.stickerGreeting &&
        stickerSize == other.stickerSize &&
        stickerCustomMm == other.stickerCustomMm &&
        logoUrl == other.logoUrl &&
        storeName == other.storeName &&
        vietqrTimeoutMinutes == other.vietqrTimeoutMinutes &&
        vietqrAvailable == other.vietqrAvailable;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, brandColor.hashCode);
    _$hash = $jc(_$hash, textColor.hashCode);
    _$hash = $jc(_$hash, buttonColor.hashCode);
    _$hash = $jc(_$hash, bannerEnabled.hashCode);
    _$hash = $jc(_$hash, bannerPromotionIds.hashCode);
    _$hash = $jc(_$hash, bestSellersEnabled.hashCode);
    _$hash = $jc(_$hash, bestSellersSource.hashCode);
    _$hash = $jc(_$hash, bestSellerItemIds.hashCode);
    _$hash = $jc(_$hash, bestSellersLimit.hashCode);
    _$hash = $jc(_$hash, bestSellersAutoIds.hashCode);
    _$hash = $jc(_$hash, newItemsEnabled.hashCode);
    _$hash = $jc(_$hash, newItemIds.hashCode);
    _$hash = $jc(_$hash, minOrderIntervalSeconds.hashCode);
    _$hash = $jc(_$hash, paused.hashCode);
    _$hash = $jc(_$hash, paymentTiming.hashCode);
    _$hash = $jc(_$hash, payMethods.hashCode);
    _$hash = $jc(_$hash, prepayTimeoutMinutes.hashCode);
    _$hash = $jc(_$hash, stickerShowLogo.hashCode);
    _$hash = $jc(_$hash, stickerShowName.hashCode);
    _$hash = $jc(_$hash, stickerStoreName.hashCode);
    _$hash = $jc(_$hash, stickerWifiEnabled.hashCode);
    _$hash = $jc(_$hash, stickerWifiName.hashCode);
    _$hash = $jc(_$hash, stickerWifiPassword.hashCode);
    _$hash = $jc(_$hash, stickerGreeting.hashCode);
    _$hash = $jc(_$hash, stickerSize.hashCode);
    _$hash = $jc(_$hash, stickerCustomMm.hashCode);
    _$hash = $jc(_$hash, logoUrl.hashCode);
    _$hash = $jc(_$hash, storeName.hashCode);
    _$hash = $jc(_$hash, vietqrTimeoutMinutes.hashCode);
    _$hash = $jc(_$hash, vietqrAvailable.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuSettings')
          ..add('brandColor', brandColor)
          ..add('textColor', textColor)
          ..add('buttonColor', buttonColor)
          ..add('bannerEnabled', bannerEnabled)
          ..add('bannerPromotionIds', bannerPromotionIds)
          ..add('bestSellersEnabled', bestSellersEnabled)
          ..add('bestSellersSource', bestSellersSource)
          ..add('bestSellerItemIds', bestSellerItemIds)
          ..add('bestSellersLimit', bestSellersLimit)
          ..add('bestSellersAutoIds', bestSellersAutoIds)
          ..add('newItemsEnabled', newItemsEnabled)
          ..add('newItemIds', newItemIds)
          ..add('minOrderIntervalSeconds', minOrderIntervalSeconds)
          ..add('paused', paused)
          ..add('paymentTiming', paymentTiming)
          ..add('payMethods', payMethods)
          ..add('prepayTimeoutMinutes', prepayTimeoutMinutes)
          ..add('stickerShowLogo', stickerShowLogo)
          ..add('stickerShowName', stickerShowName)
          ..add('stickerStoreName', stickerStoreName)
          ..add('stickerWifiEnabled', stickerWifiEnabled)
          ..add('stickerWifiName', stickerWifiName)
          ..add('stickerWifiPassword', stickerWifiPassword)
          ..add('stickerGreeting', stickerGreeting)
          ..add('stickerSize', stickerSize)
          ..add('stickerCustomMm', stickerCustomMm)
          ..add('logoUrl', logoUrl)
          ..add('storeName', storeName)
          ..add('vietqrTimeoutMinutes', vietqrTimeoutMinutes)
          ..add('vietqrAvailable', vietqrAvailable))
        .toString();
  }
}

class EmenuSettingsBuilder
    implements Builder<EmenuSettings, EmenuSettingsBuilder> {
  _$EmenuSettings? _$v;

  String? _brandColor;
  String? get brandColor => _$this._brandColor;
  set brandColor(String? brandColor) => _$this._brandColor = brandColor;

  String? _textColor;
  String? get textColor => _$this._textColor;
  set textColor(String? textColor) => _$this._textColor = textColor;

  String? _buttonColor;
  String? get buttonColor => _$this._buttonColor;
  set buttonColor(String? buttonColor) => _$this._buttonColor = buttonColor;

  bool? _bannerEnabled;
  bool? get bannerEnabled => _$this._bannerEnabled;
  set bannerEnabled(bool? bannerEnabled) =>
      _$this._bannerEnabled = bannerEnabled;

  ListBuilder<String>? _bannerPromotionIds;
  ListBuilder<String> get bannerPromotionIds =>
      _$this._bannerPromotionIds ??= ListBuilder<String>();
  set bannerPromotionIds(ListBuilder<String>? bannerPromotionIds) =>
      _$this._bannerPromotionIds = bannerPromotionIds;

  bool? _bestSellersEnabled;
  bool? get bestSellersEnabled => _$this._bestSellersEnabled;
  set bestSellersEnabled(bool? bestSellersEnabled) =>
      _$this._bestSellersEnabled = bestSellersEnabled;

  EmenuSettingsBestSellersSourceEnum? _bestSellersSource;
  EmenuSettingsBestSellersSourceEnum? get bestSellersSource =>
      _$this._bestSellersSource;
  set bestSellersSource(
          EmenuSettingsBestSellersSourceEnum? bestSellersSource) =>
      _$this._bestSellersSource = bestSellersSource;

  ListBuilder<String>? _bestSellerItemIds;
  ListBuilder<String> get bestSellerItemIds =>
      _$this._bestSellerItemIds ??= ListBuilder<String>();
  set bestSellerItemIds(ListBuilder<String>? bestSellerItemIds) =>
      _$this._bestSellerItemIds = bestSellerItemIds;

  int? _bestSellersLimit;
  int? get bestSellersLimit => _$this._bestSellersLimit;
  set bestSellersLimit(int? bestSellersLimit) =>
      _$this._bestSellersLimit = bestSellersLimit;

  ListBuilder<String>? _bestSellersAutoIds;
  ListBuilder<String> get bestSellersAutoIds =>
      _$this._bestSellersAutoIds ??= ListBuilder<String>();
  set bestSellersAutoIds(ListBuilder<String>? bestSellersAutoIds) =>
      _$this._bestSellersAutoIds = bestSellersAutoIds;

  bool? _newItemsEnabled;
  bool? get newItemsEnabled => _$this._newItemsEnabled;
  set newItemsEnabled(bool? newItemsEnabled) =>
      _$this._newItemsEnabled = newItemsEnabled;

  ListBuilder<String>? _newItemIds;
  ListBuilder<String> get newItemIds =>
      _$this._newItemIds ??= ListBuilder<String>();
  set newItemIds(ListBuilder<String>? newItemIds) =>
      _$this._newItemIds = newItemIds;

  int? _minOrderIntervalSeconds;
  int? get minOrderIntervalSeconds => _$this._minOrderIntervalSeconds;
  set minOrderIntervalSeconds(int? minOrderIntervalSeconds) =>
      _$this._minOrderIntervalSeconds = minOrderIntervalSeconds;

  bool? _paused;
  bool? get paused => _$this._paused;
  set paused(bool? paused) => _$this._paused = paused;

  EmenuSettingsPaymentTimingEnum? _paymentTiming;
  EmenuSettingsPaymentTimingEnum? get paymentTiming => _$this._paymentTiming;
  set paymentTiming(EmenuSettingsPaymentTimingEnum? paymentTiming) =>
      _$this._paymentTiming = paymentTiming;

  ListBuilder<EmenuSettingsPayMethodsEnum>? _payMethods;
  ListBuilder<EmenuSettingsPayMethodsEnum> get payMethods =>
      _$this._payMethods ??= ListBuilder<EmenuSettingsPayMethodsEnum>();
  set payMethods(ListBuilder<EmenuSettingsPayMethodsEnum>? payMethods) =>
      _$this._payMethods = payMethods;

  int? _prepayTimeoutMinutes;
  int? get prepayTimeoutMinutes => _$this._prepayTimeoutMinutes;
  set prepayTimeoutMinutes(int? prepayTimeoutMinutes) =>
      _$this._prepayTimeoutMinutes = prepayTimeoutMinutes;

  bool? _stickerShowLogo;
  bool? get stickerShowLogo => _$this._stickerShowLogo;
  set stickerShowLogo(bool? stickerShowLogo) =>
      _$this._stickerShowLogo = stickerShowLogo;

  bool? _stickerShowName;
  bool? get stickerShowName => _$this._stickerShowName;
  set stickerShowName(bool? stickerShowName) =>
      _$this._stickerShowName = stickerShowName;

  String? _stickerStoreName;
  String? get stickerStoreName => _$this._stickerStoreName;
  set stickerStoreName(String? stickerStoreName) =>
      _$this._stickerStoreName = stickerStoreName;

  bool? _stickerWifiEnabled;
  bool? get stickerWifiEnabled => _$this._stickerWifiEnabled;
  set stickerWifiEnabled(bool? stickerWifiEnabled) =>
      _$this._stickerWifiEnabled = stickerWifiEnabled;

  String? _stickerWifiName;
  String? get stickerWifiName => _$this._stickerWifiName;
  set stickerWifiName(String? stickerWifiName) =>
      _$this._stickerWifiName = stickerWifiName;

  String? _stickerWifiPassword;
  String? get stickerWifiPassword => _$this._stickerWifiPassword;
  set stickerWifiPassword(String? stickerWifiPassword) =>
      _$this._stickerWifiPassword = stickerWifiPassword;

  String? _stickerGreeting;
  String? get stickerGreeting => _$this._stickerGreeting;
  set stickerGreeting(String? stickerGreeting) =>
      _$this._stickerGreeting = stickerGreeting;

  EmenuSettingsStickerSizeEnum? _stickerSize;
  EmenuSettingsStickerSizeEnum? get stickerSize => _$this._stickerSize;
  set stickerSize(EmenuSettingsStickerSizeEnum? stickerSize) =>
      _$this._stickerSize = stickerSize;

  int? _stickerCustomMm;
  int? get stickerCustomMm => _$this._stickerCustomMm;
  set stickerCustomMm(int? stickerCustomMm) =>
      _$this._stickerCustomMm = stickerCustomMm;

  String? _logoUrl;
  String? get logoUrl => _$this._logoUrl;
  set logoUrl(String? logoUrl) => _$this._logoUrl = logoUrl;

  String? _storeName;
  String? get storeName => _$this._storeName;
  set storeName(String? storeName) => _$this._storeName = storeName;

  int? _vietqrTimeoutMinutes;
  int? get vietqrTimeoutMinutes => _$this._vietqrTimeoutMinutes;
  set vietqrTimeoutMinutes(int? vietqrTimeoutMinutes) =>
      _$this._vietqrTimeoutMinutes = vietqrTimeoutMinutes;

  bool? _vietqrAvailable;
  bool? get vietqrAvailable => _$this._vietqrAvailable;
  set vietqrAvailable(bool? vietqrAvailable) =>
      _$this._vietqrAvailable = vietqrAvailable;

  EmenuSettingsBuilder() {
    EmenuSettings._defaults(this);
  }

  EmenuSettingsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _brandColor = $v.brandColor;
      _textColor = $v.textColor;
      _buttonColor = $v.buttonColor;
      _bannerEnabled = $v.bannerEnabled;
      _bannerPromotionIds = $v.bannerPromotionIds.toBuilder();
      _bestSellersEnabled = $v.bestSellersEnabled;
      _bestSellersSource = $v.bestSellersSource;
      _bestSellerItemIds = $v.bestSellerItemIds.toBuilder();
      _bestSellersLimit = $v.bestSellersLimit;
      _bestSellersAutoIds = $v.bestSellersAutoIds.toBuilder();
      _newItemsEnabled = $v.newItemsEnabled;
      _newItemIds = $v.newItemIds.toBuilder();
      _minOrderIntervalSeconds = $v.minOrderIntervalSeconds;
      _paused = $v.paused;
      _paymentTiming = $v.paymentTiming;
      _payMethods = $v.payMethods.toBuilder();
      _prepayTimeoutMinutes = $v.prepayTimeoutMinutes;
      _stickerShowLogo = $v.stickerShowLogo;
      _stickerShowName = $v.stickerShowName;
      _stickerStoreName = $v.stickerStoreName;
      _stickerWifiEnabled = $v.stickerWifiEnabled;
      _stickerWifiName = $v.stickerWifiName;
      _stickerWifiPassword = $v.stickerWifiPassword;
      _stickerGreeting = $v.stickerGreeting;
      _stickerSize = $v.stickerSize;
      _stickerCustomMm = $v.stickerCustomMm;
      _logoUrl = $v.logoUrl;
      _storeName = $v.storeName;
      _vietqrTimeoutMinutes = $v.vietqrTimeoutMinutes;
      _vietqrAvailable = $v.vietqrAvailable;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuSettings other) {
    _$v = other as _$EmenuSettings;
  }

  @override
  void update(void Function(EmenuSettingsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuSettings build() => _build();

  _$EmenuSettings _build() {
    _$EmenuSettings _$result;
    try {
      _$result = _$v ??
          _$EmenuSettings._(
            brandColor: BuiltValueNullFieldError.checkNotNull(
                brandColor, r'EmenuSettings', 'brandColor'),
            textColor: BuiltValueNullFieldError.checkNotNull(
                textColor, r'EmenuSettings', 'textColor'),
            buttonColor: BuiltValueNullFieldError.checkNotNull(
                buttonColor, r'EmenuSettings', 'buttonColor'),
            bannerEnabled: BuiltValueNullFieldError.checkNotNull(
                bannerEnabled, r'EmenuSettings', 'bannerEnabled'),
            bannerPromotionIds: bannerPromotionIds.build(),
            bestSellersEnabled: BuiltValueNullFieldError.checkNotNull(
                bestSellersEnabled, r'EmenuSettings', 'bestSellersEnabled'),
            bestSellersSource: BuiltValueNullFieldError.checkNotNull(
                bestSellersSource, r'EmenuSettings', 'bestSellersSource'),
            bestSellerItemIds: bestSellerItemIds.build(),
            bestSellersLimit: BuiltValueNullFieldError.checkNotNull(
                bestSellersLimit, r'EmenuSettings', 'bestSellersLimit'),
            bestSellersAutoIds: bestSellersAutoIds.build(),
            newItemsEnabled: BuiltValueNullFieldError.checkNotNull(
                newItemsEnabled, r'EmenuSettings', 'newItemsEnabled'),
            newItemIds: newItemIds.build(),
            minOrderIntervalSeconds: BuiltValueNullFieldError.checkNotNull(
                minOrderIntervalSeconds,
                r'EmenuSettings',
                'minOrderIntervalSeconds'),
            paused: BuiltValueNullFieldError.checkNotNull(
                paused, r'EmenuSettings', 'paused'),
            paymentTiming: BuiltValueNullFieldError.checkNotNull(
                paymentTiming, r'EmenuSettings', 'paymentTiming'),
            payMethods: payMethods.build(),
            prepayTimeoutMinutes: BuiltValueNullFieldError.checkNotNull(
                prepayTimeoutMinutes, r'EmenuSettings', 'prepayTimeoutMinutes'),
            stickerShowLogo: BuiltValueNullFieldError.checkNotNull(
                stickerShowLogo, r'EmenuSettings', 'stickerShowLogo'),
            stickerShowName: BuiltValueNullFieldError.checkNotNull(
                stickerShowName, r'EmenuSettings', 'stickerShowName'),
            stickerStoreName: BuiltValueNullFieldError.checkNotNull(
                stickerStoreName, r'EmenuSettings', 'stickerStoreName'),
            stickerWifiEnabled: BuiltValueNullFieldError.checkNotNull(
                stickerWifiEnabled, r'EmenuSettings', 'stickerWifiEnabled'),
            stickerWifiName: BuiltValueNullFieldError.checkNotNull(
                stickerWifiName, r'EmenuSettings', 'stickerWifiName'),
            stickerWifiPassword: BuiltValueNullFieldError.checkNotNull(
                stickerWifiPassword, r'EmenuSettings', 'stickerWifiPassword'),
            stickerGreeting: BuiltValueNullFieldError.checkNotNull(
                stickerGreeting, r'EmenuSettings', 'stickerGreeting'),
            stickerSize: BuiltValueNullFieldError.checkNotNull(
                stickerSize, r'EmenuSettings', 'stickerSize'),
            stickerCustomMm: BuiltValueNullFieldError.checkNotNull(
                stickerCustomMm, r'EmenuSettings', 'stickerCustomMm'),
            logoUrl: logoUrl,
            storeName: BuiltValueNullFieldError.checkNotNull(
                storeName, r'EmenuSettings', 'storeName'),
            vietqrTimeoutMinutes: BuiltValueNullFieldError.checkNotNull(
                vietqrTimeoutMinutes, r'EmenuSettings', 'vietqrTimeoutMinutes'),
            vietqrAvailable: BuiltValueNullFieldError.checkNotNull(
                vietqrAvailable, r'EmenuSettings', 'vietqrAvailable'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'bannerPromotionIds';
        bannerPromotionIds.build();

        _$failedField = 'bestSellerItemIds';
        bestSellerItemIds.build();

        _$failedField = 'bestSellersAutoIds';
        bestSellersAutoIds.build();

        _$failedField = 'newItemIds';
        newItemIds.build();

        _$failedField = 'payMethods';
        payMethods.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuSettings', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
