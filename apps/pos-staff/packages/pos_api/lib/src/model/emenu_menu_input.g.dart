// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_menu_input.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuMenuInput extends EmenuMenuInput {
  @override
  final String branchId;
  @override
  final BuiltList<EmenuMenuCategoryInput> categories;

  factory _$EmenuMenuInput([void Function(EmenuMenuInputBuilder)? updates]) =>
      (EmenuMenuInputBuilder()..update(updates))._build();

  _$EmenuMenuInput._({required this.branchId, required this.categories})
      : super._();
  @override
  EmenuMenuInput rebuild(void Function(EmenuMenuInputBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuMenuInputBuilder toBuilder() => EmenuMenuInputBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuMenuInput &&
        branchId == other.branchId &&
        categories == other.categories;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, branchId.hashCode);
    _$hash = $jc(_$hash, categories.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuMenuInput')
          ..add('branchId', branchId)
          ..add('categories', categories))
        .toString();
  }
}

class EmenuMenuInputBuilder
    implements Builder<EmenuMenuInput, EmenuMenuInputBuilder> {
  _$EmenuMenuInput? _$v;

  String? _branchId;
  String? get branchId => _$this._branchId;
  set branchId(String? branchId) => _$this._branchId = branchId;

  ListBuilder<EmenuMenuCategoryInput>? _categories;
  ListBuilder<EmenuMenuCategoryInput> get categories =>
      _$this._categories ??= ListBuilder<EmenuMenuCategoryInput>();
  set categories(ListBuilder<EmenuMenuCategoryInput>? categories) =>
      _$this._categories = categories;

  EmenuMenuInputBuilder() {
    EmenuMenuInput._defaults(this);
  }

  EmenuMenuInputBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _branchId = $v.branchId;
      _categories = $v.categories.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuMenuInput other) {
    _$v = other as _$EmenuMenuInput;
  }

  @override
  void update(void Function(EmenuMenuInputBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuMenuInput build() => _build();

  _$EmenuMenuInput _build() {
    _$EmenuMenuInput _$result;
    try {
      _$result = _$v ??
          _$EmenuMenuInput._(
            branchId: BuiltValueNullFieldError.checkNotNull(
                branchId, r'EmenuMenuInput', 'branchId'),
            categories: categories.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'categories';
        categories.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuMenuInput', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
