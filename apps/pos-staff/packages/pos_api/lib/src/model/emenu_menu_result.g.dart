// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_menu_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuMenuResult extends EmenuMenuResult {
  @override
  final BuiltList<EmenuCategory> data;

  factory _$EmenuMenuResult([void Function(EmenuMenuResultBuilder)? updates]) =>
      (EmenuMenuResultBuilder()..update(updates))._build();

  _$EmenuMenuResult._({required this.data}) : super._();
  @override
  EmenuMenuResult rebuild(void Function(EmenuMenuResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuMenuResultBuilder toBuilder() => EmenuMenuResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuMenuResult && data == other.data;
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
    return (newBuiltValueToStringHelper(r'EmenuMenuResult')..add('data', data))
        .toString();
  }
}

class EmenuMenuResultBuilder
    implements Builder<EmenuMenuResult, EmenuMenuResultBuilder> {
  _$EmenuMenuResult? _$v;

  ListBuilder<EmenuCategory>? _data;
  ListBuilder<EmenuCategory> get data =>
      _$this._data ??= ListBuilder<EmenuCategory>();
  set data(ListBuilder<EmenuCategory>? data) => _$this._data = data;

  EmenuMenuResultBuilder() {
    EmenuMenuResult._defaults(this);
  }

  EmenuMenuResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuMenuResult other) {
    _$v = other as _$EmenuMenuResult;
  }

  @override
  void update(void Function(EmenuMenuResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuMenuResult build() => _build();

  _$EmenuMenuResult _build() {
    _$EmenuMenuResult _$result;
    try {
      _$result = _$v ??
          _$EmenuMenuResult._(
            data: data.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuMenuResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
