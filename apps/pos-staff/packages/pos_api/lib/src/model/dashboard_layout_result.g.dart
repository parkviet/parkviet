// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_layout_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$DashboardLayoutResult extends DashboardLayoutResult {
  @override
  final DashboardLayout? data;

  factory _$DashboardLayoutResult(
          [void Function(DashboardLayoutResultBuilder)? updates]) =>
      (DashboardLayoutResultBuilder()..update(updates))._build();

  _$DashboardLayoutResult._({this.data}) : super._();
  @override
  DashboardLayoutResult rebuild(
          void Function(DashboardLayoutResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  DashboardLayoutResultBuilder toBuilder() =>
      DashboardLayoutResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DashboardLayoutResult && data == other.data;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'DashboardLayoutResult')
          ..add('data', data))
        .toString();
  }
}

class DashboardLayoutResultBuilder
    implements Builder<DashboardLayoutResult, DashboardLayoutResultBuilder> {
  _$DashboardLayoutResult? _$v;

  DashboardLayoutBuilder? _data;
  DashboardLayoutBuilder get data => _$this._data ??= DashboardLayoutBuilder();
  set data(DashboardLayoutBuilder? data) => _$this._data = data;

  DashboardLayoutResultBuilder() {
    DashboardLayoutResult._defaults(this);
  }

  DashboardLayoutResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DashboardLayoutResult other) {
    _$v = other as _$DashboardLayoutResult;
  }

  @override
  void update(void Function(DashboardLayoutResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DashboardLayoutResult build() => _build();

  _$DashboardLayoutResult _build() {
    _$DashboardLayoutResult _$result;
    try {
      _$result = _$v ??
          _$DashboardLayoutResult._(
            data: _data?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'DashboardLayoutResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
