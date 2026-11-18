// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'emenu_item.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EmenuItem extends EmenuItem {
  @override
  final String id;
  @override
  final String menuItemId;
  @override
  final int position;

  factory _$EmenuItem([void Function(EmenuItemBuilder)? updates]) =>
      (EmenuItemBuilder()..update(updates))._build();

  _$EmenuItem._(
      {required this.id, required this.menuItemId, required this.position})
      : super._();
  @override
  EmenuItem rebuild(void Function(EmenuItemBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EmenuItemBuilder toBuilder() => EmenuItemBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EmenuItem &&
        id == other.id &&
        menuItemId == other.menuItemId &&
        position == other.position;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, menuItemId.hashCode);
    _$hash = $jc(_$hash, position.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EmenuItem')
          ..add('id', id)
          ..add('menuItemId', menuItemId)
          ..add('position', position))
        .toString();
  }
}

class EmenuItemBuilder implements Builder<EmenuItem, EmenuItemBuilder> {
  _$EmenuItem? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _menuItemId;
  String? get menuItemId => _$this._menuItemId;
  set menuItemId(String? menuItemId) => _$this._menuItemId = menuItemId;

  int? _position;
  int? get position => _$this._position;
  set position(int? position) => _$this._position = position;

  EmenuItemBuilder() {
    EmenuItem._defaults(this);
  }

  EmenuItemBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _menuItemId = $v.menuItemId;
      _position = $v.position;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EmenuItem other) {
    _$v = other as _$EmenuItem;
  }

  @override
  void update(void Function(EmenuItemBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EmenuItem build() => _build();

  _$EmenuItem _build() {
    final _$result = _$v ??
        _$EmenuItem._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'EmenuItem', 'id'),
          menuItemId: BuiltValueNullFieldError.checkNotNull(
              menuItemId, r'EmenuItem', 'menuItemId'),
          position: BuiltValueNullFieldError.checkNotNull(
              position, r'EmenuItem', 'position'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
