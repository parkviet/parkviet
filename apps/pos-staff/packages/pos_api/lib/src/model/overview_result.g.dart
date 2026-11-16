// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OverviewResult extends OverviewResult {
  @override
  final Overview data;

  factory _$OverviewResult([void Function(OverviewResultBuilder)? updates]) =>
      (OverviewResultBuilder()..update(updates))._build();

  _$OverviewResult._({required this.data}) : super._();
  @override
  OverviewResult rebuild(void Function(OverviewResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OverviewResultBuilder toBuilder() => OverviewResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OverviewResult && data == other.data;
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
    return (newBuiltValueToStringHelper(r'OverviewResult')..add('data', data))
        .toString();
  }
}

class OverviewResultBuilder
    implements Builder<OverviewResult, OverviewResultBuilder> {
  _$OverviewResult? _$v;

  OverviewBuilder? _data;
  OverviewBuilder get data => _$this._data ??= OverviewBuilder();
  set data(OverviewBuilder? data) => _$this._data = data;

  OverviewResultBuilder() {
    OverviewResult._defaults(this);
  }

  OverviewResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OverviewResult other) {
    _$v = other as _$OverviewResult;
  }

  @override
  void update(void Function(OverviewResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OverviewResult build() => _build();

  _$OverviewResult _build() {
    _$OverviewResult _$result;
    try {
      _$result = _$v ??
          _$OverviewResult._(
            data: data.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'OverviewResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
