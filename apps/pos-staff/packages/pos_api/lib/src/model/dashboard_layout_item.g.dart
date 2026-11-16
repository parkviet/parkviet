// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_layout_item.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$DashboardLayoutItem extends DashboardLayoutItem {
  @override
  final String id;
  @override
  final String widget;
  @override
  final int x;
  @override
  final int y;
  @override
  final int w;
  @override
  final int h;
  @override
  final BuiltMap<String, JsonObject?>? options;

  factory _$DashboardLayoutItem(
          [void Function(DashboardLayoutItemBuilder)? updates]) =>
      (DashboardLayoutItemBuilder()..update(updates))._build();

  _$DashboardLayoutItem._(
      {required this.id,
      required this.widget,
      required this.x,
      required this.y,
      required this.w,
      required this.h,
      this.options})
      : super._();
  @override
  DashboardLayoutItem rebuild(
          void Function(DashboardLayoutItemBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  DashboardLayoutItemBuilder toBuilder() =>
      DashboardLayoutItemBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DashboardLayoutItem &&
        id == other.id &&
        widget == other.widget &&
        x == other.x &&
        y == other.y &&
        w == other.w &&
        h == other.h &&
        options == other.options;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, widget.hashCode);
    _$hash = $jc(_$hash, x.hashCode);
    _$hash = $jc(_$hash, y.hashCode);
    _$hash = $jc(_$hash, w.hashCode);
    _$hash = $jc(_$hash, h.hashCode);
    _$hash = $jc(_$hash, options.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'DashboardLayoutItem')
          ..add('id', id)
          ..add('widget', widget)
          ..add('x', x)
          ..add('y', y)
          ..add('w', w)
          ..add('h', h)
          ..add('options', options))
        .toString();
  }
}

class DashboardLayoutItemBuilder
    implements Builder<DashboardLayoutItem, DashboardLayoutItemBuilder> {
  _$DashboardLayoutItem? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _widget;
  String? get widget => _$this._widget;
  set widget(String? widget) => _$this._widget = widget;

  int? _x;
  int? get x => _$this._x;
  set x(int? x) => _$this._x = x;

  int? _y;
  int? get y => _$this._y;
  set y(int? y) => _$this._y = y;

  int? _w;
  int? get w => _$this._w;
  set w(int? w) => _$this._w = w;

  int? _h;
  int? get h => _$this._h;
  set h(int? h) => _$this._h = h;

  MapBuilder<String, JsonObject?>? _options;
  MapBuilder<String, JsonObject?> get options =>
      _$this._options ??= MapBuilder<String, JsonObject?>();
  set options(MapBuilder<String, JsonObject?>? options) =>
      _$this._options = options;

  DashboardLayoutItemBuilder() {
    DashboardLayoutItem._defaults(this);
  }

  DashboardLayoutItemBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _widget = $v.widget;
      _x = $v.x;
      _y = $v.y;
      _w = $v.w;
      _h = $v.h;
      _options = $v.options?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DashboardLayoutItem other) {
    _$v = other as _$DashboardLayoutItem;
  }

  @override
  void update(void Function(DashboardLayoutItemBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DashboardLayoutItem build() => _build();

  _$DashboardLayoutItem _build() {
    _$DashboardLayoutItem _$result;
    try {
      _$result = _$v ??
          _$DashboardLayoutItem._(
            id: BuiltValueNullFieldError.checkNotNull(
                id, r'DashboardLayoutItem', 'id'),
            widget: BuiltValueNullFieldError.checkNotNull(
                widget, r'DashboardLayoutItem', 'widget'),
            x: BuiltValueNullFieldError.checkNotNull(
                x, r'DashboardLayoutItem', 'x'),
            y: BuiltValueNullFieldError.checkNotNull(
                y, r'DashboardLayoutItem', 'y'),
            w: BuiltValueNullFieldError.checkNotNull(
                w, r'DashboardLayoutItem', 'w'),
            h: BuiltValueNullFieldError.checkNotNull(
                h, r'DashboardLayoutItem', 'h'),
            options: _options?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'options';
        _options?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'DashboardLayoutItem', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
