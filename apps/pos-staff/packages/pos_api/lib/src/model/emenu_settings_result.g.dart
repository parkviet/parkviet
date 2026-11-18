// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_settings_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuSettingsResult extends EmenuSettingsResult {
  @override
  final EmenuSettings data;

  factory _$EmenuSettingsResult(
          [void Function(EmenuSettingsResultBuilder)? updates]) =>
      (EmenuSettingsResultBuilder()..update(updates))._build();

  _$EmenuSettingsResult._({required this.data}) : super._();
  @override
  EmenuSettingsResult rebuild(
          void Function(EmenuSettingsResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuSettingsResultBuilder toBuilder() =>
      EmenuSettingsResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuSettingsResult && data == other.data;
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
    return (newBuiltValueToStringHelper(r'EmenuSettingsResult')
          ..add('data', data))
        .toString();
  }
}

class EmenuSettingsResultBuilder
    implements Builder<EmenuSettingsResult, EmenuSettingsResultBuilder> {
  _$EmenuSettingsResult? _$v;

  EmenuSettingsBuilder? _data;
  EmenuSettingsBuilder get data => _$this._data ??= EmenuSettingsBuilder();
  set data(EmenuSettingsBuilder? data) => _$this._data = data;

  EmenuSettingsResultBuilder() {
    EmenuSettingsResult._defaults(this);
  }

  EmenuSettingsResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuSettingsResult other) {
    _$v = other as _$EmenuSettingsResult;
  }

  @override
  void update(void Function(EmenuSettingsResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuSettingsResult build() => _build();

  _$EmenuSettingsResult _build() {
    _$EmenuSettingsResult _$result;
    try {
      _$result = _$v ??
          _$EmenuSettingsResult._(
            data: data.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuSettingsResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
