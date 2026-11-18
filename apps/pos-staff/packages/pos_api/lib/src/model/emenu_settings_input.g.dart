// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_settings_input.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const EmenuSettingsInputBestSellersSourceEnum
    _$emenuSettingsInputBestSellersSourceEnum_manual =
    const EmenuSettingsInputBestSellersSourceEnum._('manual');
const EmenuSettingsInputBestSellersSourceEnum
    _$emenuSettingsInputBestSellersSourceEnum_auto =
    const EmenuSettingsInputBestSellersSourceEnum._('auto');

EmenuSettingsInputBestSellersSourceEnum
    _$emenuSettingsInputBestSellersSourceEnumValueOf(String name) {
  switch (name) {
    case 'manual':
      return _$emenuSettingsInputBestSellersSourceEnum_manual;
    case 'auto':
      return _$emenuSettingsInputBestSellersSourceEnum_auto;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsInputBestSellersSourceEnum>
    _$emenuSettingsInputBestSellersSourceEnumValues = BuiltSet<
        EmenuSettingsInputBestSellersSourceEnum>(const <EmenuSettingsInputBestSellersSourceEnum>[
  _$emenuSettingsInputBestSellersSourceEnum_manual,
  _$emenuSettingsInputBestSellersSourceEnum_auto,
]);

const EmenuSettingsInputPaymentTimingEnum
    _$emenuSettingsInputPaymentTimingEnum_payAfter =
    const EmenuSettingsInputPaymentTimingEnum._('payAfter');
const EmenuSettingsInputPaymentTimingEnum
    _$emenuSettingsInputPaymentTimingEnum_payBefore =
    const EmenuSettingsInputPaymentTimingEnum._('payBefore');

EmenuSettingsInputPaymentTimingEnum
    _$emenuSettingsInputPaymentTimingEnumValueOf(String name) {
  switch (name) {
    case 'payAfter':
      return _$emenuSettingsInputPaymentTimingEnum_payAfter;
    case 'payBefore':
      return _$emenuSettingsInputPaymentTimingEnum_payBefore;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsInputPaymentTimingEnum>
    _$emenuSettingsInputPaymentTimingEnumValues = BuiltSet<
        EmenuSettingsInputPaymentTimingEnum>(const <EmenuSettingsInputPaymentTimingEnum>[
  _$emenuSettingsInputPaymentTimingEnum_payAfter,
  _$emenuSettingsInputPaymentTimingEnum_payBefore,
]);

const EmenuSettingsInputPayMethodsEnum
    _$emenuSettingsInputPayMethodsEnum_vietqr =
    const EmenuSettingsInputPayMethodsEnum._('vietqr');
const EmenuSettingsInputPayMethodsEnum
    _$emenuSettingsInputPayMethodsEnum_counter =
    const EmenuSettingsInputPayMethodsEnum._('counter');

EmenuSettingsInputPayMethodsEnum _$emenuSettingsInputPayMethodsEnumValueOf(
    String name) {
  switch (name) {
    case 'vietqr':
      return _$emenuSettingsInputPayMethodsEnum_vietqr;
    case 'counter':
      return _$emenuSettingsInputPayMethodsEnum_counter;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsInputPayMethodsEnum>
    _$emenuSettingsInputPayMethodsEnumValues = BuiltSet<
        EmenuSettingsInputPayMethodsEnum>(const <EmenuSettingsInputPayMethodsEnum>[
  _$emenuSettingsInputPayMethodsEnum_vietqr,
  _$emenuSettingsInputPayMethodsEnum_counter,
]);

const EmenuSettingsInputStickerSizeEnum
    _$emenuSettingsInputStickerSizeEnum_n60 =
    const EmenuSettingsInputStickerSizeEnum._('n60');
const EmenuSettingsInputStickerSizeEnum
    _$emenuSettingsInputStickerSizeEnum_n80 =
    const EmenuSettingsInputStickerSizeEnum._('n80');
const EmenuSettingsInputStickerSizeEnum
    _$emenuSettingsInputStickerSizeEnum_n100 =
    const EmenuSettingsInputStickerSizeEnum._('n100');
const EmenuSettingsInputStickerSizeEnum
    _$emenuSettingsInputStickerSizeEnum_custom =
    const EmenuSettingsInputStickerSizeEnum._('custom');

EmenuSettingsInputStickerSizeEnum _$emenuSettingsInputStickerSizeEnumValueOf(
    String name) {
  switch (name) {
    case 'n60':
      return _$emenuSettingsInputStickerSizeEnum_n60;
    case 'n80':
      return _$emenuSettingsInputStickerSizeEnum_n80;
    case 'n100':
      return _$emenuSettingsInputStickerSizeEnum_n100;
    case 'custom':
      return _$emenuSettingsInputStickerSizeEnum_custom;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<EmenuSettingsInputStickerSizeEnum>
    _$emenuSettingsInputStickerSizeEnumValues = BuiltSet<
        EmenuSettingsInputStickerSizeEnum>(const <EmenuSettingsInputStickerSizeEnum>[
  _$emenuSettingsInputStickerSizeEnum_n60,
  _$emenuSettingsInputStickerSizeEnum_n80,
  _$emenuSettingsInputStickerSizeEnum_n100,
  _$emenuSettingsInputStickerSizeEnum_custom,
]);

Serializer<EmenuSettingsInputBestSellersSourceEnum>
    _$emenuSettingsInputBestSellersSourceEnumSerializer =
    _$EmenuSettingsInputBestSellersSourceEnumSerializer();
Serializer<EmenuSettingsInputPaymentTimingEnum>
    _$emenuSettingsInputPaymentTimingEnumSerializer =
    _$EmenuSettingsInputPaymentTimingEnumSerializer();
Serializer<EmenuSettingsInputPayMethodsEnum>
    _$emenuSettingsInputPayMethodsEnumSerializer =
    _$EmenuSettingsInputPayMethodsEnumSerializer();
Serializer<EmenuSettingsInputStickerSizeEnum>
    _$emenuSettingsInputStickerSizeEnumSerializer =
    _$EmenuSettingsInputStickerSizeEnumSerializer();

class _$EmenuSettingsInputBestSellersSourceEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsInputBestSellersSourceEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'manual': 'manual',
    'auto': 'auto',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'manual': 'manual',
    'auto': 'auto',
  };

  @override
  final Iterable<Type> types = const <Type>[
    EmenuSettingsInputBestSellersSourceEnum
  ];
  @override
  final String wireName = 'EmenuSettingsInputBestSellersSourceEnum';

  @override
  Object serialize(Serializers serializers,
          EmenuSettingsInputBestSellersSourceEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsInputBestSellersSourceEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsInputBestSellersSourceEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsInputPaymentTimingEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsInputPaymentTimingEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'payAfter': 'pay_after',
    'payBefore': 'pay_before',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'pay_after': 'payAfter',
    'pay_before': 'payBefore',
  };

  @override
  final Iterable<Type> types = const <Type>[
    EmenuSettingsInputPaymentTimingEnum
  ];
  @override
  final String wireName = 'EmenuSettingsInputPaymentTimingEnum';

  @override
  Object serialize(
          Serializers serializers, EmenuSettingsInputPaymentTimingEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsInputPaymentTimingEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsInputPaymentTimingEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsInputPayMethodsEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsInputPayMethodsEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'vietqr': 'vietqr',
    'counter': 'counter',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'vietqr': 'vietqr',
    'counter': 'counter',
  };

  @override
  final Iterable<Type> types = const <Type>[EmenuSettingsInputPayMethodsEnum];
  @override
  final String wireName = 'EmenuSettingsInputPayMethodsEnum';

  @override
  Object serialize(
          Serializers serializers, EmenuSettingsInputPayMethodsEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsInputPayMethodsEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsInputPayMethodsEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsInputStickerSizeEnumSerializer
    implements PrimitiveSerializer<EmenuSettingsInputStickerSizeEnum> {
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
  final Iterable<Type> types = const <Type>[EmenuSettingsInputStickerSizeEnum];
  @override
  final String wireName = 'EmenuSettingsInputStickerSizeEnum';

  @override
  Object serialize(
          Serializers serializers, EmenuSettingsInputStickerSizeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  EmenuSettingsInputStickerSizeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      EmenuSettingsInputStickerSizeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$EmenuSettingsInput extends EmenuSettingsInput {
  @override
  final String branchId;
  @override
  final String? brandColor;
  @override
  final String? textColor;
  @override
  final String? buttonColor;
  @override
  final bool? bannerEnabled;
  @override
  final BuiltList<String>? bannerPromotionIds;
  @override
  final bool? bestSellersEnabled;
  @override
  final EmenuSettingsInputBestSellersSourceEnum? bestSellersSource;
  @override
  final BuiltList<String>? bestSellerItemIds;
  @override
  final int? bestSellersLimit;
  @override
  final bool? newItemsEnabled;
  @override
  final BuiltList<String>? newItemIds;
  @override
  final int? minOrderIntervalSeconds;
  @override
  final bool? paused;
  @override
  final EmenuSettingsInputPaymentTimingEnum? paymentTiming;
  @override
  final BuiltList<EmenuSettingsInputPayMethodsEnum>? payMethods;
  @override
  final int? prepayTimeoutMinutes;
  @override
  final bool? stickerShowLogo;
  @override
  final bool? stickerShowName;
  @override
  final String? stickerStoreName;
  @override
  final bool? stickerWifiEnabled;
  @override
  final String? stickerWifiName;
  @override
  final String? stickerWifiPassword;
  @override
  final String? stickerGreeting;
  @override
  final EmenuSettingsInputStickerSizeEnum? stickerSize;
  @override
  final int? stickerCustomMm;

  factory _$EmenuSettingsInput(
          [void Function(EmenuSettingsInputBuilder)? updates]) =>
      (EmenuSettingsInputBuilder()..update(updates))._build();

  _$EmenuSettingsInput._(
      {required this.branchId,
      this.brandColor,
      this.textColor,
      this.buttonColor,
      this.bannerEnabled,
      this.bannerPromotionIds,
      this.bestSellersEnabled,
      this.bestSellersSource,
      this.bestSellerItemIds,
      this.bestSellersLimit,
      this.newItemsEnabled,
      this.newItemIds,
      this.minOrderIntervalSeconds,
      this.paused,
      this.paymentTiming,
      this.payMethods,
      this.prepayTimeoutMinutes,
      this.stickerShowLogo,
      this.stickerShowName,
      this.stickerStoreName,
      this.stickerWifiEnabled,
      this.stickerWifiName,
      this.stickerWifiPassword,
      this.stickerGreeting,
      this.stickerSize,
      this.stickerCustomMm})
      : super._();
  @override
  EmenuSettingsInput rebuild(
          void Function(EmenuSettingsInputBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuSettingsInputBuilder toBuilder() =>
      EmenuSettingsInputBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuSettingsInput &&
        branchId == other.branchId &&
        brandColor == other.brandColor &&
        textColor == other.textColor &&
        buttonColor == other.buttonColor &&
        bannerEnabled == other.bannerEnabled &&
        bannerPromotionIds == other.bannerPromotionIds &&
        bestSellersEnabled == other.bestSellersEnabled &&
        bestSellersSource == other.bestSellersSource &&
        bestSellerItemIds == other.bestSellerItemIds &&
        bestSellersLimit == other.bestSellersLimit &&
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
        stickerCustomMm == other.stickerCustomMm;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, branchId.hashCode);
    _$hash = $jc(_$hash, brandColor.hashCode);
    _$hash = $jc(_$hash, textColor.hashCode);
    _$hash = $jc(_$hash, buttonColor.hashCode);
    _$hash = $jc(_$hash, bannerEnabled.hashCode);
    _$hash = $jc(_$hash, bannerPromotionIds.hashCode);
    _$hash = $jc(_$hash, bestSellersEnabled.hashCode);
    _$hash = $jc(_$hash, bestSellersSource.hashCode);
    _$hash = $jc(_$hash, bestSellerItemIds.hashCode);
    _$hash = $jc(_$hash, bestSellersLimit.hashCode);
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
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuSettingsInput')
          ..add('branchId', branchId)
          ..add('brandColor', brandColor)
          ..add('textColor', textColor)
          ..add('buttonColor', buttonColor)
          ..add('bannerEnabled', bannerEnabled)
          ..add('bannerPromotionIds', bannerPromotionIds)
          ..add('bestSellersEnabled', bestSellersEnabled)
          ..add('bestSellersSource', bestSellersSource)
          ..add('bestSellerItemIds', bestSellerItemIds)
          ..add('bestSellersLimit', bestSellersLimit)
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
          ..add('stickerCustomMm', stickerCustomMm))
        .toString();
  }
}

class EmenuSettingsInputBuilder
    implements Builder<EmenuSettingsInput, EmenuSettingsInputBuilder> {
  _$EmenuSettingsInput? _$v;

  String? _branchId;
  String? get branchId => _$this._branchId;
  set branchId(String? branchId) => _$this._branchId = branchId;

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

  EmenuSettingsInputBestSellersSourceEnum? _bestSellersSource;
  EmenuSettingsInputBestSellersSourceEnum? get bestSellersSource =>
      _$this._bestSellersSource;
  set bestSellersSource(
          EmenuSettingsInputBestSellersSourceEnum? bestSellersSource) =>
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

  EmenuSettingsInputPaymentTimingEnum? _paymentTiming;
  EmenuSettingsInputPaymentTimingEnum? get paymentTiming =>
      _$this._paymentTiming;
  set paymentTiming(EmenuSettingsInputPaymentTimingEnum? paymentTiming) =>
      _$this._paymentTiming = paymentTiming;

  ListBuilder<EmenuSettingsInputPayMethodsEnum>? _payMethods;
  ListBuilder<EmenuSettingsInputPayMethodsEnum> get payMethods =>
      _$this._payMethods ??= ListBuilder<EmenuSettingsInputPayMethodsEnum>();
  set payMethods(ListBuilder<EmenuSettingsInputPayMethodsEnum>? payMethods) =>
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

  EmenuSettingsInputStickerSizeEnum? _stickerSize;
  EmenuSettingsInputStickerSizeEnum? get stickerSize => _$this._stickerSize;
  set stickerSize(EmenuSettingsInputStickerSizeEnum? stickerSize) =>
      _$this._stickerSize = stickerSize;

  int? _stickerCustomMm;
  int? get stickerCustomMm => _$this._stickerCustomMm;
  set stickerCustomMm(int? stickerCustomMm) =>
      _$this._stickerCustomMm = stickerCustomMm;

  EmenuSettingsInputBuilder() {
    EmenuSettingsInput._defaults(this);
  }

  EmenuSettingsInputBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _branchId = $v.branchId;
      _brandColor = $v.brandColor;
      _textColor = $v.textColor;
      _buttonColor = $v.buttonColor;
      _bannerEnabled = $v.bannerEnabled;
      _bannerPromotionIds = $v.bannerPromotionIds?.toBuilder();
      _bestSellersEnabled = $v.bestSellersEnabled;
      _bestSellersSource = $v.bestSellersSource;
      _bestSellerItemIds = $v.bestSellerItemIds?.toBuilder();
      _bestSellersLimit = $v.bestSellersLimit;
      _newItemsEnabled = $v.newItemsEnabled;
      _newItemIds = $v.newItemIds?.toBuilder();
      _minOrderIntervalSeconds = $v.minOrderIntervalSeconds;
      _paused = $v.paused;
      _paymentTiming = $v.paymentTiming;
      _payMethods = $v.payMethods?.toBuilder();
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
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuSettingsInput other) {
    _$v = other as _$EmenuSettingsInput;
  }

  @override
  void update(void Function(EmenuSettingsInputBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuSettingsInput build() => _build();

  _$EmenuSettingsInput _build() {
    _$EmenuSettingsInput _$result;
    try {
      _$result = _$v ??
          _$EmenuSettingsInput._(
            branchId: BuiltValueNullFieldError.checkNotNull(
                branchId, r'EmenuSettingsInput', 'branchId'),
            brandColor: brandColor,
            textColor: textColor,
            buttonColor: buttonColor,
            bannerEnabled: bannerEnabled,
            bannerPromotionIds: _bannerPromotionIds?.build(),
            bestSellersEnabled: bestSellersEnabled,
            bestSellersSource: bestSellersSource,
            bestSellerItemIds: _bestSellerItemIds?.build(),
            bestSellersLimit: bestSellersLimit,
            newItemsEnabled: newItemsEnabled,
            newItemIds: _newItemIds?.build(),
            minOrderIntervalSeconds: minOrderIntervalSeconds,
            paused: paused,
            paymentTiming: paymentTiming,
            payMethods: _payMethods?.build(),
            prepayTimeoutMinutes: prepayTimeoutMinutes,
            stickerShowLogo: stickerShowLogo,
            stickerShowName: stickerShowName,
            stickerStoreName: stickerStoreName,
            stickerWifiEnabled: stickerWifiEnabled,
            stickerWifiName: stickerWifiName,
            stickerWifiPassword: stickerWifiPassword,
            stickerGreeting: stickerGreeting,
            stickerSize: stickerSize,
            stickerCustomMm: stickerCustomMm,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'bannerPromotionIds';
        _bannerPromotionIds?.build();

        _$failedField = 'bestSellerItemIds';
        _bestSellerItemIds?.build();

        _$failedField = 'newItemIds';
        _newItemIds?.build();

        _$failedField = 'payMethods';
        _payMethods?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuSettingsInput', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
