// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_menu_import_input.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuMenuImportInput extends EmenuMenuImportInput {
  @override
  final String branchId;

  factory _$EmenuMenuImportInput(
          [void Function(EmenuMenuImportInputBuilder)? updates]) =>
      (EmenuMenuImportInputBuilder()..update(updates))._build();

  _$EmenuMenuImportInput._({required this.branchId}) : super._();
  @override
  EmenuMenuImportInput rebuild(
          void Function(EmenuMenuImportInputBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuMenuImportInputBuilder toBuilder() =>
      EmenuMenuImportInputBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuMenuImportInput && branchId == other.branchId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, branchId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuMenuImportInput')
          ..add('branchId', branchId))
        .toString();
  }
}

class EmenuMenuImportInputBuilder
    implements Builder<EmenuMenuImportInput, EmenuMenuImportInputBuilder> {
  _$EmenuMenuImportInput? _$v;

  String? _branchId;
  String? get branchId => _$this._branchId;
  set branchId(String? branchId) => _$this._branchId = branchId;

  EmenuMenuImportInputBuilder() {
    EmenuMenuImportInput._defaults(this);
  }

  EmenuMenuImportInputBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _branchId = $v.branchId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuMenuImportInput other) {
    _$v = other as _$EmenuMenuImportInput;
  }

  @override
  void update(void Function(EmenuMenuImportInputBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuMenuImportInput build() => _build();

  _$EmenuMenuImportInput _build() {
    final _$result = _$v ??
        _$EmenuMenuImportInput._(
          branchId: BuiltValueNullFieldError.checkNotNull(
              branchId, r'EmenuMenuImportInput', 'branchId'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
