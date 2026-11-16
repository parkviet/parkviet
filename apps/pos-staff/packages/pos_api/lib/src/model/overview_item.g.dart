// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_item.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewItem extends OverviewItem {
  @override
  final String? variantId;
  @override
  final String name;
  @override
  final String? sku;
  @override
  final String? baseUnit;
  @override
  final int quantity;
  @override
  final String revenue;

  factory _$OverviewItem([void Function(OverviewItemBuilder)? updates]) =>
      (OverviewItemBuilder()..update(updates))._build();

  _$OverviewItem._(
      {this.variantId,
      required this.name,
      this.sku,
      this.baseUnit,
      required this.quantity,
      required this.revenue})
      : super._();
  @override
  OverviewItem rebuild(void Function(OverviewItemBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewItemBuilder toBuilder() => OverviewItemBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewItem &&
        variantId == other.variantId &&
        name == other.name &&
        sku == other.sku &&
        baseUnit == other.baseUnit &&
        quantity == other.quantity &&
        revenue == other.revenue;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, variantId.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, sku.hashCode);
    _$hash = $jc(_$hash, baseUnit.hashCode);
    _$hash = $jc(_$hash, quantity.hashCode);
    _$hash = $jc(_$hash, revenue.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewItem')
          ..add('variantId', variantId)
          ..add('name', name)
          ..add('sku', sku)
          ..add('baseUnit', baseUnit)
          ..add('quantity', quantity)
          ..add('revenue', revenue))
        .toString();
  }
}

class OverviewItemBuilder
    implements Builder<OverviewItem, OverviewItemBuilder> {
  _$OverviewItem? _$v;

  String? _variantId;
  String? get variantId => _$this._variantId;
  set variantId(String? variantId) => _$this._variantId = variantId;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _sku;
  String? get sku => _$this._sku;
  set sku(String? sku) => _$this._sku = sku;

  String? _baseUnit;
  String? get baseUnit => _$this._baseUnit;
  set baseUnit(String? baseUnit) => _$this._baseUnit = baseUnit;

  int? _quantity;
  int? get quantity => _$this._quantity;
  set quantity(int? quantity) => _$this._quantity = quantity;

  String? _revenue;
  String? get revenue => _$this._revenue;
  set revenue(String? revenue) => _$this._revenue = revenue;

  OverviewItemBuilder() {
    OverviewItem._defaults(this);
  }

  OverviewItemBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _variantId = $v.variantId;
      _name = $v.name;
      _sku = $v.sku;
      _baseUnit = $v.baseUnit;
      _quantity = $v.quantity;
      _revenue = $v.revenue;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewItem other) {
    _$v = other as _$OverviewItem;
  }

  @override
  void update(void Function(OverviewItemBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewItem build() => _build();

  _$OverviewItem _build() {
    final _$result = _$v ??
        _$OverviewItem._(
          variantId: variantId,
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'OverviewItem', 'name'),
          sku: sku,
          baseUnit: baseUnit,
          quantity: BuiltValueNullFieldError.checkNotNull(
              quantity, r'OverviewItem', 'quantity'),
          revenue: BuiltValueNullFieldError.checkNotNull(
              revenue, r'OverviewItem', 'revenue'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
