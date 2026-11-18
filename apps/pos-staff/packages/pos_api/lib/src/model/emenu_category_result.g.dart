// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_category_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuCategoryResult extends EmenuCategoryResult {
  @override
  final EmenuCategory data;

  factory _$EmenuCategoryResult(
          [void Function(EmenuCategoryResultBuilder)? updates]) =>
      (EmenuCategoryResultBuilder()..update(updates))._build();

  _$EmenuCategoryResult._({required this.data}) : super._();
  @override
  EmenuCategoryResult rebuild(
          void Function(EmenuCategoryResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuCategoryResultBuilder toBuilder() =>
      EmenuCategoryResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuCategoryResult && data == other.data;
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
    return (newBuiltValueToStringHelper(r'EmenuCategoryResult')
          ..add('data', data))
        .toString();
  }
}

class EmenuCategoryResultBuilder
    implements Builder<EmenuCategoryResult, EmenuCategoryResultBuilder> {
  _$EmenuCategoryResult? _$v;

  EmenuCategoryBuilder? _data;
  EmenuCategoryBuilder get data => _$this._data ??= EmenuCategoryBuilder();
  set data(EmenuCategoryBuilder? data) => _$this._data = data;

  EmenuCategoryResultBuilder() {
    EmenuCategoryResult._defaults(this);
  }

  EmenuCategoryResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuCategoryResult other) {
    _$v = other as _$EmenuCategoryResult;
  }

  @override
  void update(void Function(EmenuCategoryResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuCategoryResult build() => _build();

  _$EmenuCategoryResult _build() {
    _$EmenuCategoryResult _$result;
    try {
      _$result = _$v ??
          _$EmenuCategoryResult._(
            data: data.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuCategoryResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
