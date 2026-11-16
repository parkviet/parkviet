// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_totals.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewTotals extends OverviewTotals {
  @override
  final int orders;
  @override
  final String salesTotal;
  @override
  final int returns;
  @override
  final String returnsTotal;
  @override
  final String netSales;
  @override
  final int offlineOrders;
  @override
  final String offlineTotal;
  @override
  final int customers;

  factory _$OverviewTotals([void Function(OverviewTotalsBuilder)? updates]) =>
      (OverviewTotalsBuilder()..update(updates))._build();

  _$OverviewTotals._(
      {required this.orders,
      required this.salesTotal,
      required this.returns,
      required this.returnsTotal,
      required this.netSales,
      required this.offlineOrders,
      required this.offlineTotal,
      required this.customers})
      : super._();
  @override
  OverviewTotals rebuild(void Function(OverviewTotalsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewTotalsBuilder toBuilder() => OverviewTotalsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewTotals &&
        orders == other.orders &&
        salesTotal == other.salesTotal &&
        returns == other.returns &&
        returnsTotal == other.returnsTotal &&
        netSales == other.netSales &&
        offlineOrders == other.offlineOrders &&
        offlineTotal == other.offlineTotal &&
        customers == other.customers;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, orders.hashCode);
    _$hash = $jc(_$hash, salesTotal.hashCode);
    _$hash = $jc(_$hash, returns.hashCode);
    _$hash = $jc(_$hash, returnsTotal.hashCode);
    _$hash = $jc(_$hash, netSales.hashCode);
    _$hash = $jc(_$hash, offlineOrders.hashCode);
    _$hash = $jc(_$hash, offlineTotal.hashCode);
    _$hash = $jc(_$hash, customers.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewTotals')
          ..add('orders', orders)
          ..add('salesTotal', salesTotal)
          ..add('returns', returns)
          ..add('returnsTotal', returnsTotal)
          ..add('netSales', netSales)
          ..add('offlineOrders', offlineOrders)
          ..add('offlineTotal', offlineTotal)
          ..add('customers', customers))
        .toString();
  }
}

class OverviewTotalsBuilder
    implements Builder<OverviewTotals, OverviewTotalsBuilder> {
  _$OverviewTotals? _$v;

  int? _orders;
  int? get orders => _$this._orders;
  set orders(int? orders) => _$this._orders = orders;

  String? _salesTotal;
  String? get salesTotal => _$this._salesTotal;
  set salesTotal(String? salesTotal) => _$this._salesTotal = salesTotal;

  int? _returns;
  int? get returns => _$this._returns;
  set returns(int? returns) => _$this._returns = returns;

  String? _returnsTotal;
  String? get returnsTotal => _$this._returnsTotal;
  set returnsTotal(String? returnsTotal) => _$this._returnsTotal = returnsTotal;

  String? _netSales;
  String? get netSales => _$this._netSales;
  set netSales(String? netSales) => _$this._netSales = netSales;

  int? _offlineOrders;
  int? get offlineOrders => _$this._offlineOrders;
  set offlineOrders(int? offlineOrders) =>
      _$this._offlineOrders = offlineOrders;

  String? _offlineTotal;
  String? get offlineTotal => _$this._offlineTotal;
  set offlineTotal(String? offlineTotal) => _$this._offlineTotal = offlineTotal;

  int? _customers;
  int? get customers => _$this._customers;
  set customers(int? customers) => _$this._customers = customers;

  OverviewTotalsBuilder() {
    OverviewTotals._defaults(this);
  }

  OverviewTotalsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _orders = $v.orders;
      _salesTotal = $v.salesTotal;
      _returns = $v.returns;
      _returnsTotal = $v.returnsTotal;
      _netSales = $v.netSales;
      _offlineOrders = $v.offlineOrders;
      _offlineTotal = $v.offlineTotal;
      _customers = $v.customers;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewTotals other) {
    _$v = other as _$OverviewTotals;
  }

  @override
  void update(void Function(OverviewTotalsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewTotals build() => _build();

  _$OverviewTotals _build() {
    final _$result = _$v ??
        _$OverviewTotals._(
          orders: BuiltValueNullFieldError.checkNotNull(
              orders, r'OverviewTotals', 'orders'),
          salesTotal: BuiltValueNullFieldError.checkNotNull(
              salesTotal, r'OverviewTotals', 'salesTotal'),
          returns: BuiltValueNullFieldError.checkNotNull(
              returns, r'OverviewTotals', 'returns'),
          returnsTotal: BuiltValueNullFieldError.checkNotNull(
              returnsTotal, r'OverviewTotals', 'returnsTotal'),
          netSales: BuiltValueNullFieldError.checkNotNull(
              netSales, r'OverviewTotals', 'netSales'),
          offlineOrders: BuiltValueNullFieldError.checkNotNull(
              offlineOrders, r'OverviewTotals', 'offlineOrders'),
          offlineTotal: BuiltValueNullFieldError.checkNotNull(
              offlineTotal, r'OverviewTotals', 'offlineTotal'),
          customers: BuiltValueNullFieldError.checkNotNull(
              customers, r'OverviewTotals', 'customers'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
