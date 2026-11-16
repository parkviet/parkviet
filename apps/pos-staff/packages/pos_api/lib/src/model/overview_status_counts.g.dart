// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_status_counts.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewStatusCounts extends OverviewStatusCounts {
  @override
  final int all;
  @override
  final int debt;
  @override
  final int returned;
  @override
  final int refundPending;

  factory _$OverviewStatusCounts(
          [void Function(OverviewStatusCountsBuilder)? updates]) =>
      (OverviewStatusCountsBuilder()..update(updates))._build();

  _$OverviewStatusCounts._(
      {required this.all,
      required this.debt,
      required this.returned,
      required this.refundPending})
      : super._();
  @override
  OverviewStatusCounts rebuild(
          void Function(OverviewStatusCountsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewStatusCountsBuilder toBuilder() =>
      OverviewStatusCountsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewStatusCounts &&
        all == other.all &&
        debt == other.debt &&
        returned == other.returned &&
        refundPending == other.refundPending;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, all.hashCode);
    _$hash = $jc(_$hash, debt.hashCode);
    _$hash = $jc(_$hash, returned.hashCode);
    _$hash = $jc(_$hash, refundPending.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OverviewStatusCounts')
          ..add('all', all)
          ..add('debt', debt)
          ..add('returned', returned)
          ..add('refundPending', refundPending))
        .toString();
  }
}

class OverviewStatusCountsBuilder
    implements Builder<OverviewStatusCounts, OverviewStatusCountsBuilder> {
  _$OverviewStatusCounts? _$v;

  int? _all;
  int? get all => _$this._all;
  set all(int? all) => _$this._all = all;

  int? _debt;
  int? get debt => _$this._debt;
  set debt(int? debt) => _$this._debt = debt;

  int? _returned;
  int? get returned => _$this._returned;
  set returned(int? returned) => _$this._returned = returned;

  int? _refundPending;
  int? get refundPending => _$this._refundPending;
  set refundPending(int? refundPending) =>
      _$this._refundPending = refundPending;

  OverviewStatusCountsBuilder() {
    OverviewStatusCounts._defaults(this);
  }

  OverviewStatusCountsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _all = $v.all;
      _debt = $v.debt;
      _returned = $v.returned;
      _refundPending = $v.refundPending;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewStatusCounts other) {
    _$v = other as _$OverviewStatusCounts;
  }

  @override
  void update(void Function(OverviewStatusCountsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewStatusCounts build() => _build();

  _$OverviewStatusCounts _build() {
    final _$result = _$v ??
        _$OverviewStatusCounts._(
          all: BuiltValueNullFieldError.checkNotNull(
              all, r'OverviewStatusCounts', 'all'),
          debt: BuiltValueNullFieldError.checkNotNull(
              debt, r'OverviewStatusCounts', 'debt'),
          returned: BuiltValueNullFieldError.checkNotNull(
              returned, r'OverviewStatusCounts', 'returned'),
          refundPending: BuiltValueNullFieldError.checkNotNull(
              refundPending, r'OverviewStatusCounts', 'refundPending'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
