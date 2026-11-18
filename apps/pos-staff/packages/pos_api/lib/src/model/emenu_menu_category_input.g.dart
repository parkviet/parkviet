// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_menu_category_input.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuMenuCategoryInput extends EmenuMenuCategoryInput {
  @override
  final String? id;
  @override
  final String name;
  @override
  final String? color;
  @override
  final BuiltList<String> items;

  factory _$EmenuMenuCategoryInput(
          [void Function(EmenuMenuCategoryInputBuilder)? updates]) =>
      (EmenuMenuCategoryInputBuilder()..update(updates))._build();

  _$EmenuMenuCategoryInput._(
      {this.id, required this.name, this.color, required this.items})
      : super._();
  @override
  EmenuMenuCategoryInput rebuild(
          void Function(EmenuMenuCategoryInputBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuMenuCategoryInputBuilder toBuilder() =>
      EmenuMenuCategoryInputBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuMenuCategoryInput &&
        id == other.id &&
        name == other.name &&
        color == other.color &&
        items == other.items;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, color.hashCode);
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuMenuCategoryInput')
          ..add('id', id)
          ..add('name', name)
          ..add('color', color)
          ..add('items', items))
        .toString();
  }
}

class EmenuMenuCategoryInputBuilder
    implements Builder<EmenuMenuCategoryInput, EmenuMenuCategoryInputBuilder> {
  _$EmenuMenuCategoryInput? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _color;
  String? get color => _$this._color;
  set color(String? color) => _$this._color = color;

  ListBuilder<String>? _items;
  ListBuilder<String> get items => _$this._items ??= ListBuilder<String>();
  set items(ListBuilder<String>? items) => _$this._items = items;

  EmenuMenuCategoryInputBuilder() {
    EmenuMenuCategoryInput._defaults(this);
  }

  EmenuMenuCategoryInputBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _color = $v.color;
      _items = $v.items.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuMenuCategoryInput other) {
    _$v = other as _$EmenuMenuCategoryInput;
  }

  @override
  void update(void Function(EmenuMenuCategoryInputBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuMenuCategoryInput build() => _build();

  _$EmenuMenuCategoryInput _build() {
    _$EmenuMenuCategoryInput _$result;
    try {
      _$result = _$v ??
          _$EmenuMenuCategoryInput._(
            id: id,
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'EmenuMenuCategoryInput', 'name'),
            color: color,
            items: items.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuMenuCategoryInput', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
