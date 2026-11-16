// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_top_items.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewTopItems extends OverviewTopItems {
  @override
  final BuiltList<OverviewItem> byQuantity;
  @override
  final BuiltList<OverviewItem> byRevenue;

  factory _$OverviewTopItems(
          [void Function(OverviewTopItemsBuilder)? updates]) =>
      (OverviewTopItemsBuilder()..update(updates))._build();

  _$OverviewTopItems._({required this.byQuantity, required this.byRevenue})
      : super._();
  @override
  OverviewTopItems rebuild(void Function(OverviewTopItemsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewTopItemsBuilder toBuilder() =>
      OverviewTopItemsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewTopItems &&
        byQuantity == other.byQuantity &&
        byRevenue == other.byRevenue;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, byQuantity.hashCode);
    _$hash = $jc(_$hash, byRevenue.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewTopItems')
          ..add('byQuantity', byQuantity)
          ..add('byRevenue', byRevenue))
        .toString();
  }
}

class OverviewTopItemsBuilder
    implements Builder<OverviewTopItems, OverviewTopItemsBuilder> {
  _$OverviewTopItems? _$v;

  ListBuilder<OverviewItem>? _byQuantity;
  ListBuilder<OverviewItem> get byQuantity =>
      _$this._byQuantity ??= ListBuilder<OverviewItem>();
  set byQuantity(ListBuilder<OverviewItem>? byQuantity) =>
      _$this._byQuantity = byQuantity;

  ListBuilder<OverviewItem>? _byRevenue;
  ListBuilder<OverviewItem> get byRevenue =>
      _$this._byRevenue ??= ListBuilder<OverviewItem>();
  set byRevenue(ListBuilder<OverviewItem>? byRevenue) =>
      _$this._byRevenue = byRevenue;

  OverviewTopItemsBuilder() {
    OverviewTopItems._defaults(this);
  }

  OverviewTopItemsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _byQuantity = $v.byQuantity.toBuilder();
      _byRevenue = $v.byRevenue.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewTopItems other) {
    _$v = other as _$OverviewTopItems;
  }

  @override
  void update(void Function(OverviewTopItemsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewTopItems build() => _build();

  _$OverviewTopItems _build() {
    _$OverviewTopItems _$result;
    try {
      _$result = _$v ??
          _$OverviewTopItems._(
            byQuantity: byQuantity.build(),
            byRevenue: byRevenue.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'byQuantity';
        byQuantity.build();
        _$failedField = 'byRevenue';
        byRevenue.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'OverviewTopItems', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
