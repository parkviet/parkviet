// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_category.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuCategory extends EmenuCategory {
  @override
  final String id;
  @override
  final String name;
  @override
  final int position;
  @override
  final String? color;
  @override
  final String? imageUrl;
  @override
  final BuiltList<EmenuItem> items;

  factory _$EmenuCategory([void Function(EmenuCategoryBuilder)? updates]) =>
      (EmenuCategoryBuilder()..update(updates))._build();

  _$EmenuCategory._(
      {required this.id,
      required this.name,
      required this.position,
      this.color,
      this.imageUrl,
      required this.items})
      : super._();
  @override
  EmenuCategory rebuild(void Function(EmenuCategoryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuCategoryBuilder toBuilder() => EmenuCategoryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuCategory &&
        id == other.id &&
        name == other.name &&
        position == other.position &&
        color == other.color &&
        imageUrl == other.imageUrl &&
        items == other.items;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, position.hashCode);
    _$hash = $jc(_$hash, color.hashCode);
    _$hash = $jc(_$hash, imageUrl.hashCode);
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuCategory')
          ..add('id', id)
          ..add('name', name)
          ..add('position', position)
          ..add('color', color)
          ..add('imageUrl', imageUrl)
          ..add('items', items))
        .toString();
  }
}

class EmenuCategoryBuilder
    implements Builder<EmenuCategory, EmenuCategoryBuilder> {
  _$EmenuCategory? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  int? _position;
  int? get position => _$this._position;
  set position(int? position) => _$this._position = position;

  String? _color;
  String? get color => _$this._color;
  set color(String? color) => _$this._color = color;

  String? _imageUrl;
  String? get imageUrl => _$this._imageUrl;
  set imageUrl(String? imageUrl) => _$this._imageUrl = imageUrl;

  ListBuilder<EmenuItem>? _items;
  ListBuilder<EmenuItem> get items =>
      _$this._items ??= ListBuilder<EmenuItem>();
  set items(ListBuilder<EmenuItem>? items) => _$this._items = items;

  EmenuCategoryBuilder() {
    EmenuCategory._defaults(this);
  }

  EmenuCategoryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _position = $v.position;
      _color = $v.color;
      _imageUrl = $v.imageUrl;
      _items = $v.items.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuCategory other) {
    _$v = other as _$EmenuCategory;
  }

  @override
  void update(void Function(EmenuCategoryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuCategory build() => _build();

  _$EmenuCategory _build() {
    _$EmenuCategory _$result;
    try {
      _$result = _$v ??
          _$EmenuCategory._(
            id: BuiltValueNullFieldError.checkNotNull(
                id, r'EmenuCategory', 'id'),
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'EmenuCategory', 'name'),
            position: BuiltValueNullFieldError.checkNotNull(
                position, r'EmenuCategory', 'position'),
            color: color,
            imageUrl: imageUrl,
            items: items.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'EmenuCategory', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
