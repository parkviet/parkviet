// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_stock_alerts.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewStockAlerts extends OverviewStockAlerts {
  @override
  final int outOfStock;
  @override
  final int lowStock;
  @override
  final int expiringSoon;
  @override
  final int nearExpiryDays;

  factory _$OverviewStockAlerts(
          [void Function(OverviewStockAlertsBuilder)? updates]) =>
      (OverviewStockAlertsBuilder()..update(updates))._build();

  _$OverviewStockAlerts._(
      {required this.outOfStock,
      required this.lowStock,
      required this.expiringSoon,
      required this.nearExpiryDays})
      : super._();
  @override
  OverviewStockAlerts rebuild(
          void Function(OverviewStockAlertsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewStockAlertsBuilder toBuilder() =>
      OverviewStockAlertsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewStockAlerts &&
        outOfStock == other.outOfStock &&
        lowStock == other.lowStock &&
        expiringSoon == other.expiringSoon &&
        nearExpiryDays == other.nearExpiryDays;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, outOfStock.hashCode);
    _$hash = $jc(_$hash, lowStock.hashCode);
    _$hash = $jc(_$hash, expiringSoon.hashCode);
    _$hash = $jc(_$hash, nearExpiryDays.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewStockAlerts')
          ..add('outOfStock', outOfStock)
          ..add('lowStock', lowStock)
          ..add('expiringSoon', expiringSoon)
          ..add('nearExpiryDays', nearExpiryDays))
        .toString();
  }
}

class OverviewStockAlertsBuilder
    implements Builder<OverviewStockAlerts, OverviewStockAlertsBuilder> {
  _$OverviewStockAlerts? _$v;

  int? _outOfStock;
  int? get outOfStock => _$this._outOfStock;
  set outOfStock(int? outOfStock) => _$this._outOfStock = outOfStock;

  int? _lowStock;
  int? get lowStock => _$this._lowStock;
  set lowStock(int? lowStock) => _$this._lowStock = lowStock;

  int? _expiringSoon;
  int? get expiringSoon => _$this._expiringSoon;
  set expiringSoon(int? expiringSoon) => _$this._expiringSoon = expiringSoon;

  int? _nearExpiryDays;
  int? get nearExpiryDays => _$this._nearExpiryDays;
  set nearExpiryDays(int? nearExpiryDays) =>
      _$this._nearExpiryDays = nearExpiryDays;

  OverviewStockAlertsBuilder() {
    OverviewStockAlerts._defaults(this);
  }

  OverviewStockAlertsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _outOfStock = $v.outOfStock;
      _lowStock = $v.lowStock;
      _expiringSoon = $v.expiringSoon;
      _nearExpiryDays = $v.nearExpiryDays;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewStockAlerts other) {
    _$v = other as _$OverviewStockAlerts;
  }

  @override
  void update(void Function(OverviewStockAlertsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewStockAlerts build() => _build();

  _$OverviewStockAlerts _build() {
    final _$result = _$v ??
        _$OverviewStockAlerts._(
          outOfStock: BuiltValueNullFieldError.checkNotNull(
              outOfStock, r'OverviewStockAlerts', 'outOfStock'),
          lowStock: BuiltValueNullFieldError.checkNotNull(
              lowStock, r'OverviewStockAlerts', 'lowStock'),
          expiringSoon: BuiltValueNullFieldError.checkNotNull(
              expiringSoon, r'OverviewStockAlerts', 'expiringSoon'),
          nearExpiryDays: BuiltValueNullFieldError.checkNotNull(
              nearExpiryDays, r'OverviewStockAlerts', 'nearExpiryDays'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
