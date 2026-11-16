// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_layout.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$DashboardLayout extends DashboardLayout {
  @override
  final BuiltList<DashboardLayoutItem> layout;
  @override
  final int version;
  @override
  final DateTime updatedAt;

  factory _$DashboardLayout([void Function(DashboardLayoutBuilder)? updates]) =>
      (DashboardLayoutBuilder()..update(updates))._build();

  _$DashboardLayout._(
      {required this.layout, required this.version, required this.updatedAt})
      : super._();
  @override
  DashboardLayout rebuild(void Function(DashboardLayoutBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  DashboardLayoutBuilder toBuilder() => DashboardLayoutBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DashboardLayout &&
        layout == other.layout &&
        version == other.version &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, layout.hashCode);
    _$hash = $jc(_$hash, version.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'DashboardLayout')
          ..add('layout', layout)
          ..add('version', version)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class DashboardLayoutBuilder
    implements Builder<DashboardLayout, DashboardLayoutBuilder> {
  _$DashboardLayout? _$v;

  ListBuilder<DashboardLayoutItem>? _layout;
  ListBuilder<DashboardLayoutItem> get layout =>
      _$this._layout ??= ListBuilder<DashboardLayoutItem>();
  set layout(ListBuilder<DashboardLayoutItem>? layout) =>
      _$this._layout = layout;

  int? _version;
  int? get version => _$this._version;
  set version(int? version) => _$this._version = version;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  DashboardLayoutBuilder() {
    DashboardLayout._defaults(this);
  }

  DashboardLayoutBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _layout = $v.layout.toBuilder();
      _version = $v.version;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DashboardLayout other) {
    _$v = other as _$DashboardLayout;
  }

  @override
  void update(void Function(DashboardLayoutBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DashboardLayout build() => _build();

  _$DashboardLayout _build() {
    _$DashboardLayout _$result;
    try {
      _$result = _$v ??
          _$DashboardLayout._(
            layout: layout.build(),
            version: BuiltValueNullFieldError.checkNotNull(
                version, r'DashboardLayout', 'version'),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
                updatedAt, r'DashboardLayout', 'updatedAt'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'layout';
        layout.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'DashboardLayout', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
