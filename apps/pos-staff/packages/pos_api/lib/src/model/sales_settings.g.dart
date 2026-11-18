// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sales_settings.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const SalesSettingsCartOrderEnum _$salesSettingsCartOrderEnum_newestFirst =
    const SalesSettingsCartOrderEnum._('newestFirst');
const SalesSettingsCartOrderEnum _$salesSettingsCartOrderEnum_oldestFirst =
    const SalesSettingsCartOrderEnum._('oldestFirst');

SalesSettingsCartOrderEnum _$salesSettingsCartOrderEnumValueOf(String name) {
  switch (name) {
    case 'newestFirst':
      return _$salesSettingsCartOrderEnum_newestFirst;
    case 'oldestFirst':
      return _$salesSettingsCartOrderEnum_oldestFirst;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<SalesSettingsCartOrderEnum> _$salesSettingsCartOrderEnumValues =
    BuiltSet<SalesSettingsCartOrderEnum>(const <SalesSettingsCartOrderEnum>[
  _$salesSettingsCartOrderEnum_newestFirst,
  _$salesSettingsCartOrderEnum_oldestFirst,
]);

const SalesSettingsPaymentChimeEnum _$salesSettingsPaymentChimeEnum_off =
    const SalesSettingsPaymentChimeEnum._('off');
const SalesSettingsPaymentChimeEnum _$salesSettingsPaymentChimeEnum_default_ =
    const SalesSettingsPaymentChimeEnum._('default_');

SalesSettingsPaymentChimeEnum _$salesSettingsPaymentChimeEnumValueOf(
    String name) {
  switch (name) {
    case 'off':
      return _$salesSettingsPaymentChimeEnum_off;
    case 'default_':
      return _$salesSettingsPaymentChimeEnum_default_;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<SalesSettingsPaymentChimeEnum>
    _$salesSettingsPaymentChimeEnumValues = BuiltSet<
        SalesSettingsPaymentChimeEnum>(const <SalesSettingsPaymentChimeEnum>[
  _$salesSettingsPaymentChimeEnum_off,
  _$salesSettingsPaymentChimeEnum_default_,
]);

Serializer<SalesSettingsCartOrderEnum> _$salesSettingsCartOrderEnumSerializer =
    _$SalesSettingsCartOrderEnumSerializer();
Serializer<SalesSettingsPaymentChimeEnum>
    _$salesSettingsPaymentChimeEnumSerializer =
    _$SalesSettingsPaymentChimeEnumSerializer();

class _$SalesSettingsCartOrderEnumSerializer
    implements PrimitiveSerializer<SalesSettingsCartOrderEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'newestFirst': 'newest_first',
    'oldestFirst': 'oldest_first',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'newest_first': 'newestFirst',
    'oldest_first': 'oldestFirst',
  };

  @override
  final Iterable<Type> types = const <Type>[SalesSettingsCartOrderEnum];
  @override
  final String wireName = 'SalesSettingsCartOrderEnum';

  @override
  Object serialize(Serializers serializers, SalesSettingsCartOrderEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  SalesSettingsCartOrderEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      SalesSettingsCartOrderEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$SalesSettingsPaymentChimeEnumSerializer
    implements PrimitiveSerializer<SalesSettingsPaymentChimeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'off': 'off',
    'default_': 'default',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'off': 'off',
    'default': 'default_',
  };

  @override
  final Iterable<Type> types = const <Type>[SalesSettingsPaymentChimeEnum];
  @override
  final String wireName = 'SalesSettingsPaymentChimeEnum';

  @override
  Object serialize(
          Serializers serializers, SalesSettingsPaymentChimeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  SalesSettingsPaymentChimeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      SalesSettingsPaymentChimeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$SalesSettings extends SalesSettings {
  @override
  final bool? allowOversell;
  @override
  final bool? warnBelowCost;
  @override
  final bool? showStock;
  @override
  final bool? showCost;
  @override
  final SalesSettingsCartOrderEnum? cartOrder;
  @override
  final bool? orderNote;
  @override
  final bool? coupons;
  @override
  final SalesSettingsPaymentChimeEnum? paymentChime;
  @override
  final bool? autoPrintReceipt;
  @override
  final bool? inlineVariants;
  @override
  final bool? scheduledDelivery;
  @override
  final bool? autoPrintPrebill;
  @override
  final bool? printVoidTickets;
  @override
  final bool? autoPrintReadyTicket;
  @override
  final bool? allowSheetReceipts;

  factory _$SalesSettings([void Function(SalesSettingsBuilder)? updates]) =>
      (SalesSettingsBuilder()..update(updates))._build();

  _$SalesSettings._(
      {this.allowOversell,
      this.warnBelowCost,
      this.showStock,
      this.showCost,
      this.cartOrder,
      this.orderNote,
      this.coupons,
      this.paymentChime,
      this.autoPrintReceipt,
      this.inlineVariants,
      this.scheduledDelivery,
      this.autoPrintPrebill,
      this.printVoidTickets,
      this.autoPrintReadyTicket,
      this.allowSheetReceipts})
      : super._();
  @override
  SalesSettings rebuild(void Function(SalesSettingsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SalesSettingsBuilder toBuilder() => SalesSettingsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SalesSettings &&
        allowOversell == other.allowOversell &&
        warnBelowCost == other.warnBelowCost &&
        showStock == other.showStock &&
        showCost == other.showCost &&
        cartOrder == other.cartOrder &&
        orderNote == other.orderNote &&
        coupons == other.coupons &&
        paymentChime == other.paymentChime &&
        autoPrintReceipt == other.autoPrintReceipt &&
        inlineVariants == other.inlineVariants &&
        scheduledDelivery == other.scheduledDelivery &&
        autoPrintPrebill == other.autoPrintPrebill &&
        printVoidTickets == other.printVoidTickets &&
        autoPrintReadyTicket == other.autoPrintReadyTicket &&
        allowSheetReceipts == other.allowSheetReceipts;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, allowOversell.hashCode);
    _$hash = $jc(_$hash, warnBelowCost.hashCode);
    _$hash = $jc(_$hash, showStock.hashCode);
    _$hash = $jc(_$hash, showCost.hashCode);
    _$hash = $jc(_$hash, cartOrder.hashCode);
    _$hash = $jc(_$hash, orderNote.hashCode);
    _$hash = $jc(_$hash, coupons.hashCode);
    _$hash = $jc(_$hash, paymentChime.hashCode);
    _$hash = $jc(_$hash, autoPrintReceipt.hashCode);
    _$hash = $jc(_$hash, inlineVariants.hashCode);
    _$hash = $jc(_$hash, scheduledDelivery.hashCode);
    _$hash = $jc(_$hash, autoPrintPrebill.hashCode);
    _$hash = $jc(_$hash, printVoidTickets.hashCode);
    _$hash = $jc(_$hash, autoPrintReadyTicket.hashCode);
    _$hash = $jc(_$hash, allowSheetReceipts.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SalesSettings')
          ..add('allowOversell', allowOversell)
          ..add('warnBelowCost', warnBelowCost)
          ..add('showStock', showStock)
          ..add('showCost', showCost)
          ..add('cartOrder', cartOrder)
          ..add('orderNote', orderNote)
          ..add('coupons', coupons)
          ..add('paymentChime', paymentChime)
          ..add('autoPrintReceipt', autoPrintReceipt)
          ..add('inlineVariants', inlineVariants)
          ..add('scheduledDelivery', scheduledDelivery)
          ..add('autoPrintPrebill', autoPrintPrebill)
          ..add('printVoidTickets', printVoidTickets)
          ..add('autoPrintReadyTicket', autoPrintReadyTicket)
          ..add('allowSheetReceipts', allowSheetReceipts))
        .toString();
  }
}

class SalesSettingsBuilder
    implements Builder<SalesSettings, SalesSettingsBuilder> {
  _$SalesSettings? _$v;

  bool? _allowOversell;
  bool? get allowOversell => _$this._allowOversell;
  set allowOversell(bool? allowOversell) =>
      _$this._allowOversell = allowOversell;

  bool? _warnBelowCost;
  bool? get warnBelowCost => _$this._warnBelowCost;
  set warnBelowCost(bool? warnBelowCost) =>
      _$this._warnBelowCost = warnBelowCost;

  bool? _showStock;
  bool? get showStock => _$this._showStock;
  set showStock(bool? showStock) => _$this._showStock = showStock;

  bool? _showCost;
  bool? get showCost => _$this._showCost;
  set showCost(bool? showCost) => _$this._showCost = showCost;

  SalesSettingsCartOrderEnum? _cartOrder;
  SalesSettingsCartOrderEnum? get cartOrder => _$this._cartOrder;
  set cartOrder(SalesSettingsCartOrderEnum? cartOrder) =>
      _$this._cartOrder = cartOrder;

  bool? _orderNote;
  bool? get orderNote => _$this._orderNote;
  set orderNote(bool? orderNote) => _$this._orderNote = orderNote;

  bool? _coupons;
  bool? get coupons => _$this._coupons;
  set coupons(bool? coupons) => _$this._coupons = coupons;

  SalesSettingsPaymentChimeEnum? _paymentChime;
  SalesSettingsPaymentChimeEnum? get paymentChime => _$this._paymentChime;
  set paymentChime(SalesSettingsPaymentChimeEnum? paymentChime) =>
      _$this._paymentChime = paymentChime;

  bool? _autoPrintReceipt;
  bool? get autoPrintReceipt => _$this._autoPrintReceipt;
  set autoPrintReceipt(bool? autoPrintReceipt) =>
      _$this._autoPrintReceipt = autoPrintReceipt;

  bool? _inlineVariants;
  bool? get inlineVariants => _$this._inlineVariants;
  set inlineVariants(bool? inlineVariants) =>
      _$this._inlineVariants = inlineVariants;

  bool? _scheduledDelivery;
  bool? get scheduledDelivery => _$this._scheduledDelivery;
  set scheduledDelivery(bool? scheduledDelivery) =>
      _$this._scheduledDelivery = scheduledDelivery;

  bool? _autoPrintPrebill;
  bool? get autoPrintPrebill => _$this._autoPrintPrebill;
  set autoPrintPrebill(bool? autoPrintPrebill) =>
      _$this._autoPrintPrebill = autoPrintPrebill;

  bool? _printVoidTickets;
  bool? get printVoidTickets => _$this._printVoidTickets;
  set printVoidTickets(bool? printVoidTickets) =>
      _$this._printVoidTickets = printVoidTickets;

  bool? _autoPrintReadyTicket;
  bool? get autoPrintReadyTicket => _$this._autoPrintReadyTicket;
  set autoPrintReadyTicket(bool? autoPrintReadyTicket) =>
      _$this._autoPrintReadyTicket = autoPrintReadyTicket;

  bool? _allowSheetReceipts;
  bool? get allowSheetReceipts => _$this._allowSheetReceipts;
  set allowSheetReceipts(bool? allowSheetReceipts) =>
      _$this._allowSheetReceipts = allowSheetReceipts;

  SalesSettingsBuilder() {
    SalesSettings._defaults(this);
  }

  SalesSettingsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _allowOversell = $v.allowOversell;
      _warnBelowCost = $v.warnBelowCost;
      _showStock = $v.showStock;
      _showCost = $v.showCost;
      _cartOrder = $v.cartOrder;
      _orderNote = $v.orderNote;
      _coupons = $v.coupons;
      _paymentChime = $v.paymentChime;
      _autoPrintReceipt = $v.autoPrintReceipt;
      _inlineVariants = $v.inlineVariants;
      _scheduledDelivery = $v.scheduledDelivery;
      _autoPrintPrebill = $v.autoPrintPrebill;
      _printVoidTickets = $v.printVoidTickets;
      _autoPrintReadyTicket = $v.autoPrintReadyTicket;
      _allowSheetReceipts = $v.allowSheetReceipts;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SalesSettings other) {
    _$v = other as _$SalesSettings;
  }

  @override
  void update(void Function(SalesSettingsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SalesSettings build() => _build();

  _$SalesSettings _build() {
    final _$result = _$v ??
        _$SalesSettings._(
          allowOversell: allowOversell,
          warnBelowCost: warnBelowCost,
          showStock: showStock,
          showCost: showCost,
          cartOrder: cartOrder,
          orderNote: orderNote,
          coupons: coupons,
          paymentChime: paymentChime,
          autoPrintReceipt: autoPrintReceipt,
          inlineVariants: inlineVariants,
          scheduledDelivery: scheduledDelivery,
          autoPrintPrebill: autoPrintPrebill,
          printVoidTickets: printVoidTickets,
          autoPrintReadyTicket: autoPrintReadyTicket,
          allowSheetReceipts: allowSheetReceipts,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
