// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_day.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewDay extends OverviewDay {
  @override
  final Date date;
  @override
  final int orders;
  @override
  final int customers;
  @override
  final String salesTotal;
  @override
  final String returnsTotal;
  @override
  final String netSales;

  factory _$OverviewDay([void Function(OverviewDayBuilder)? updates]) =>
      (OverviewDayBuilder()..update(updates))._build();

  _$OverviewDay._(
      {required this.date,
      required this.orders,
      required this.customers,
      required this.salesTotal,
      required this.returnsTotal,
      required this.netSales})
      : super._();
  @override
  OverviewDay rebuild(void Function(OverviewDayBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewDayBuilder toBuilder() => OverviewDayBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewDay &&
        date == other.date &&
        orders == other.orders &&
        customers == other.customers &&
        salesTotal == other.salesTotal &&
        returnsTotal == other.returnsTotal &&
        netSales == other.netSales;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, date.hashCode);
    _$hash = $jc(_$hash, orders.hashCode);
    _$hash = $jc(_$hash, customers.hashCode);
    _$hash = $jc(_$hash, salesTotal.hashCode);
    _$hash = $jc(_$hash, returnsTotal.hashCode);
    _$hash = $jc(_$hash, netSales.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewDay')
          ..add('date', date)
          ..add('orders', orders)
          ..add('customers', customers)
          ..add('salesTotal', salesTotal)
          ..add('returnsTotal', returnsTotal)
          ..add('netSales', netSales))
        .toString();
  }
}

class OverviewDayBuilder implements Builder<OverviewDay, OverviewDayBuilder> {
  _$OverviewDay? _$v;

  Date? _date;
  Date? get date => _$this._date;
  set date(Date? date) => _$this._date = date;

  int? _orders;
  int? get orders => _$this._orders;
  set orders(int? orders) => _$this._orders = orders;

  int? _customers;
  int? get customers => _$this._customers;
  set customers(int? customers) => _$this._customers = customers;

  String? _salesTotal;
  String? get salesTotal => _$this._salesTotal;
  set salesTotal(String? salesTotal) => _$this._salesTotal = salesTotal;

  String? _returnsTotal;
  String? get returnsTotal => _$this._returnsTotal;
  set returnsTotal(String? returnsTotal) => _$this._returnsTotal = returnsTotal;

  String? _netSales;
  String? get netSales => _$this._netSales;
  set netSales(String? netSales) => _$this._netSales = netSales;

  OverviewDayBuilder() {
    OverviewDay._defaults(this);
  }

  OverviewDayBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _date = $v.date;
      _orders = $v.orders;
      _customers = $v.customers;
      _salesTotal = $v.salesTotal;
      _returnsTotal = $v.returnsTotal;
      _netSales = $v.netSales;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewDay other) {
    _$v = other as _$OverviewDay;
  }

  @override
  void update(void Function(OverviewDayBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewDay build() => _build();

  _$OverviewDay _build() {
    final _$result = _$v ??
        _$OverviewDay._(
          date: BuiltValueNullFieldError.checkNotNull(
              date, r'OverviewDay', 'date'),
          orders: BuiltValueNullFieldError.checkNotNull(
              orders, r'OverviewDay', 'orders'),
          customers: BuiltValueNullFieldError.checkNotNull(
              customers, r'OverviewDay', 'customers'),
          salesTotal: BuiltValueNullFieldError.checkNotNull(
              salesTotal, r'OverviewDay', 'salesTotal'),
          returnsTotal: BuiltValueNullFieldError.checkNotNull(
              returnsTotal, r'OverviewDay', 'returnsTotal'),
          netSales: BuiltValueNullFieldError.checkNotNull(
              netSales, r'OverviewDay', 'netSales'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
