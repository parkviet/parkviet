// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pos_dashboard_layout_save_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$PosDashboardLayoutSaveRequest extends PosDashboardLayoutSaveRequest {
  @override
  final BuiltList<DashboardLayoutItem> layout;

  factory _$PosDashboardLayoutSaveRequest(
          [void Function(PosDashboardLayoutSaveRequestBuilder)? updates]) =>
      (PosDashboardLayoutSaveRequestBuilder()..update(updates))._build();

  _$PosDashboardLayoutSaveRequest._({required this.layout}) : super._();
  @override
  PosDashboardLayoutSaveRequest rebuild(
          void Function(PosDashboardLayoutSaveRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  PosDashboardLayoutSaveRequestBuilder toBuilder() =>
      PosDashboardLayoutSaveRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PosDashboardLayoutSaveRequest && layout == other.layout;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, layout.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'PosDashboardLayoutSaveRequest')
          ..add('layout', layout))
        .toString();
  }
}

class PosDashboardLayoutSaveRequestBuilder
    implements
        Builder<PosDashboardLayoutSaveRequest,
            PosDashboardLayoutSaveRequestBuilder> {
  _$PosDashboardLayoutSaveRequest? _$v;

  ListBuilder<DashboardLayoutItem>? _layout;
  ListBuilder<DashboardLayoutItem> get layout =>
      _$this._layout ??= ListBuilder<DashboardLayoutItem>();
  set layout(ListBuilder<DashboardLayoutItem>? layout) =>
      _$this._layout = layout;

  PosDashboardLayoutSaveRequestBuilder() {
    PosDashboardLayoutSaveRequest._defaults(this);
  }

  PosDashboardLayoutSaveRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _layout = $v.layout.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PosDashboardLayoutSaveRequest other) {
    _$v = other as _$PosDashboardLayoutSaveRequest;
  }

  @override
  void update(void Function(PosDashboardLayoutSaveRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PosDashboardLayoutSaveRequest build() => _build();

  _$PosDashboardLayoutSaveRequest _build() {
    _$PosDashboardLayoutSaveRequest _$result;
    try {
      _$result = _$v ??
          _$PosDashboardLayoutSaveRequest._(
            layout: layout.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'layout';
        layout.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'PosDashboardLayoutSaveRequest', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
