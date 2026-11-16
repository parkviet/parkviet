// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const OverviewScopeEnum _$overviewScopeEnum_branch =
    const OverviewScopeEnum._('branch');
const OverviewScopeEnum _$overviewScopeEnum_own =
    const OverviewScopeEnum._('own');

OverviewScopeEnum _$overviewScopeEnumValueOf(String name) {
  switch (name) {
    case 'branch':
      return _$overviewScopeEnum_branch;
    case 'own':
      return _$overviewScopeEnum_own;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<OverviewScopeEnum> _$overviewScopeEnumValues =
    BuiltSet<OverviewScopeEnum>(const <OverviewScopeEnum>[
  _$overviewScopeEnum_branch,
  _$overviewScopeEnum_own,
]);

Serializer<OverviewScopeEnum> _$overviewScopeEnumSerializer =
    _$OverviewScopeEnumSerializer();

class _$OverviewScopeEnumSerializer
    implements PrimitiveSerializer<OverviewScopeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'branch': 'branch',
    'own': 'own',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'branch': 'branch',
    'own': 'own',
  };

  @override
  final Iterable<Type> types = const <Type>[OverviewScopeEnum];
  @override
  final String wireName = 'OverviewScopeEnum';

  @override
  Object serialize(Serializers serializers, OverviewScopeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  OverviewScopeEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      OverviewScopeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$Overview extends Overview {
  @override
  final String branchId;
  @override
  final String timezone;
  @override
  final OverviewScopeEnum scope;
  @override
  final Date from;
  @override
  final Date to;
  @override
  final Date? previousFrom;
  @override
  final Date? previousTo;
  @override
  final OverviewTotals totals;
  @override
  final OverviewTotals? previousTotals;
  @override
  final BuiltList<OverviewDay> byDay;
  @override
  final BuiltList<OverviewDay>? previousByDay;
  @override
  final BuiltList<OwnerHourRow> byHour;
  @override
  final BuiltList<OwnerSourceRow> bySource;
  @override
  final OverviewTopItems topItems;
  @override
  final OverviewStatusCounts statusCounts;
  @override
  final OverviewStockAlerts? stockAlerts;

  factory _$Overview([void Function(OverviewBuilder)? updates]) =>
      (OverviewBuilder()..update(updates))._build();

  _$Overview._(
      {required this.branchId,
      required this.timezone,
      required this.scope,
      required this.from,
      required this.to,
      this.previousFrom,
      this.previousTo,
      required this.totals,
      this.previousTotals,
      required this.byDay,
      this.previousByDay,
      required this.byHour,
      required this.bySource,
      required this.topItems,
      required this.statusCounts,
      this.stockAlerts})
      : super._();
  @override
  Overview rebuild(void Function(OverviewBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewBuilder toBuilder() => OverviewBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is Overview &&
        branchId == other.branchId &&
        timezone == other.timezone &&
        scope == other.scope &&
        from == other.from &&
        to == other.to &&
        previousFrom == other.previousFrom &&
        previousTo == other.previousTo &&
        totals == other.totals &&
        previousTotals == other.previousTotals &&
        byDay == other.byDay &&
        previousByDay == other.previousByDay &&
        byHour == other.byHour &&
        bySource == other.bySource &&
        topItems == other.topItems &&
        statusCounts == other.statusCounts &&
        stockAlerts == other.stockAlerts;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, branchId.hashCode);
    _$hash = $jc(_$hash, timezone.hashCode);
    _$hash = $jc(_$hash, scope.hashCode);
    _$hash = $jc(_$hash, from.hashCode);
    _$hash = $jc(_$hash, to.hashCode);
    _$hash = $jc(_$hash, previousFrom.hashCode);
    _$hash = $jc(_$hash, previousTo.hashCode);
    _$hash = $jc(_$hash, totals.hashCode);
    _$hash = $jc(_$hash, previousTotals.hashCode);
    _$hash = $jc(_$hash, byDay.hashCode);
    _$hash = $jc(_$hash, previousByDay.hashCode);
    _$hash = $jc(_$hash, byHour.hashCode);
    _$hash = $jc(_$hash, bySource.hashCode);
    _$hash = $jc(_$hash, topItems.hashCode);
    _$hash = $jc(_$hash, statusCounts.hashCode);
    _$hash = $jc(_$hash, stockAlerts.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'Overview')
          ..add('branchId', branchId)
          ..add('timezone', timezone)
          ..add('scope', scope)
          ..add('from', from)
          ..add('to', to)
          ..add('previousFrom', previousFrom)
          ..add('previousTo', previousTo)
          ..add('totals', totals)
          ..add('previousTotals', previousTotals)
          ..add('byDay', byDay)
          ..add('previousByDay', previousByDay)
          ..add('byHour', byHour)
          ..add('bySource', bySource)
          ..add('topItems', topItems)
          ..add('statusCounts', statusCounts)
          ..add('stockAlerts', stockAlerts))
        .toString();
  }
}

class OverviewBuilder implements Builder<Overview, OverviewBuilder> {
  _$Overview? _$v;

  String? _branchId;
  String? get branchId => _$this._branchId;
  set branchId(String? branchId) => _$this._branchId = branchId;

  String? _timezone;
  String? get timezone => _$this._timezone;
  set timezone(String? timezone) => _$this._timezone = timezone;

  OverviewScopeEnum? _scope;
  OverviewScopeEnum? get scope => _$this._scope;
  set scope(OverviewScopeEnum? scope) => _$this._scope = scope;

  Date? _from;
  Date? get from => _$this._from;
  set from(Date? from) => _$this._from = from;

  Date? _to;
  Date? get to => _$this._to;
  set to(Date? to) => _$this._to = to;

  Date? _previousFrom;
  Date? get previousFrom => _$this._previousFrom;
  set previousFrom(Date? previousFrom) => _$this._previousFrom = previousFrom;

  Date? _previousTo;
  Date? get previousTo => _$this._previousTo;
  set previousTo(Date? previousTo) => _$this._previousTo = previousTo;

  OverviewTotalsBuilder? _totals;
  OverviewTotalsBuilder get totals =>
      _$this._totals ??= OverviewTotalsBuilder();
  set totals(OverviewTotalsBuilder? totals) => _$this._totals = totals;

  OverviewTotalsBuilder? _previousTotals;
  OverviewTotalsBuilder get previousTotals =>
      _$this._previousTotals ??= OverviewTotalsBuilder();
  set previousTotals(OverviewTotalsBuilder? previousTotals) =>
      _$this._previousTotals = previousTotals;

  ListBuilder<OverviewDay>? _byDay;
  ListBuilder<OverviewDay> get byDay =>
      _$this._byDay ??= ListBuilder<OverviewDay>();
  set byDay(ListBuilder<OverviewDay>? byDay) => _$this._byDay = byDay;

  ListBuilder<OverviewDay>? _previousByDay;
  ListBuilder<OverviewDay> get previousByDay =>
      _$this._previousByDay ??= ListBuilder<OverviewDay>();
  set previousByDay(ListBuilder<OverviewDay>? previousByDay) =>
      _$this._previousByDay = previousByDay;

  ListBuilder<OwnerHourRow>? _byHour;
  ListBuilder<OwnerHourRow> get byHour =>
      _$this._byHour ??= ListBuilder<OwnerHourRow>();
  set byHour(ListBuilder<OwnerHourRow>? byHour) => _$this._byHour = byHour;

  ListBuilder<OwnerSourceRow>? _bySource;
  ListBuilder<OwnerSourceRow> get bySource =>
      _$this._bySource ??= ListBuilder<OwnerSourceRow>();
  set bySource(ListBuilder<OwnerSourceRow>? bySource) =>
      _$this._bySource = bySource;

  OverviewTopItemsBuilder? _topItems;
  OverviewTopItemsBuilder get topItems =>
      _$this._topItems ??= OverviewTopItemsBuilder();
  set topItems(OverviewTopItemsBuilder? topItems) =>
      _$this._topItems = topItems;

  OverviewStatusCountsBuilder? _statusCounts;
  OverviewStatusCountsBuilder get statusCounts =>
      _$this._statusCounts ??= OverviewStatusCountsBuilder();
  set statusCounts(OverviewStatusCountsBuilder? statusCounts) =>
      _$this._statusCounts = statusCounts;

  OverviewStockAlertsBuilder? _stockAlerts;
  OverviewStockAlertsBuilder get stockAlerts =>
      _$this._stockAlerts ??= OverviewStockAlertsBuilder();
  set stockAlerts(OverviewStockAlertsBuilder? stockAlerts) =>
      _$this._stockAlerts = stockAlerts;

  OverviewBuilder() {
    Overview._defaults(this);
  }

  OverviewBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _branchId = $v.branchId;
      _timezone = $v.timezone;
      _scope = $v.scope;
      _from = $v.from;
      _to = $v.to;
      _previousFrom = $v.previousFrom;
      _previousTo = $v.previousTo;
      _totals = $v.totals.toBuilder();
      _previousTotals = $v.previousTotals?.toBuilder();
      _byDay = $v.byDay.toBuilder();
      _previousByDay = $v.previousByDay?.toBuilder();
      _byHour = $v.byHour.toBuilder();
      _bySource = $v.bySource.toBuilder();
      _topItems = $v.topItems.toBuilder();
      _statusCounts = $v.statusCounts.toBuilder();
      _stockAlerts = $v.stockAlerts?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(Overview other) {
    _$v = other as _$Overview;
  }

  @override
  void update(void Function(OverviewBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  Overview build() => _build();

  _$Overview _build() {
    _$Overview _$result;
    try {
      _$result = _$v ??
          _$Overview._(
            branchId: BuiltValueNullFieldError.checkNotNull(
                branchId, r'Overview', 'branchId'),
            timezone: BuiltValueNullFieldError.checkNotNull(
                timezone, r'Overview', 'timezone'),
            scope: BuiltValueNullFieldError.checkNotNull(
                scope, r'Overview', 'scope'),
            from: BuiltValueNullFieldError.checkNotNull(
                from, r'Overview', 'from'),
            to: BuiltValueNullFieldError.checkNotNull(to, r'Overview', 'to'),
            previousFrom: previousFrom,
            previousTo: previousTo,
            totals: totals.build(),
            previousTotals: _previousTotals?.build(),
            byDay: byDay.build(),
            previousByDay: _previousByDay?.build(),
            byHour: byHour.build(),
            bySource: bySource.build(),
            topItems: topItems.build(),
            statusCounts: statusCounts.build(),
            stockAlerts: _stockAlerts?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'totals';
        totals.build();
        _$failedField = 'previousTotals';
        _previousTotals?.build();
        _$failedField = 'byDay';
        byDay.build();
        _$failedField = 'previousByDay';
        _previousByDay?.build();
        _$failedField = 'byHour';
        byHour.build();
        _$failedField = 'bySource';
        bySource.build();
        _$failedField = 'topItems';
        topItems.build();
        _$failedField = 'statusCounts';
        statusCounts.build();
        _$failedField = 'stockAlerts';
        _stockAlerts?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'Overview', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
