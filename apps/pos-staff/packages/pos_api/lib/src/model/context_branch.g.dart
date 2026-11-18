// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'context_branch.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ContextBranch extends ContextBranch {
  @override
  final String id;
  @override
  final String name;
  @override
  final BuiltList<String>? voidReasons;
  @override
  final SalesSettings? salesSettings;

  factory _$ContextBranch([void Function(ContextBranchBuilder)? updates]) =>
      (ContextBranchBuilder()..update(updates))._build();

  _$ContextBranch._(
      {required this.id,
      required this.name,
      this.voidReasons,
      this.salesSettings})
      : super._();
  @override
  ContextBranch rebuild(void Function(ContextBranchBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  ContextBranchBuilder toBuilder() => ContextBranchBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ContextBranch &&
        id == other.id &&
        name == other.name &&
        voidReasons == other.voidReasons &&
        salesSettings == other.salesSettings;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, voidReasons.hashCode);
    _$hash = $jc(_$hash, salesSettings.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ContextBranch')
          ..add('id', id)
          ..add('name', name)
          ..add('voidReasons', voidReasons)
          ..add('salesSettings', salesSettings))
        .toString();
  }
}

class ContextBranchBuilder
    implements Builder<ContextBranch, ContextBranchBuilder> {
  _$ContextBranch? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  ListBuilder<String>? _voidReasons;
  ListBuilder<String> get voidReasons =>
      _$this._voidReasons ??= ListBuilder<String>();
  set voidReasons(ListBuilder<String>? voidReasons) =>
      _$this._voidReasons = voidReasons;

  SalesSettingsBuilder? _salesSettings;
  SalesSettingsBuilder get salesSettings =>
      _$this._salesSettings ??= SalesSettingsBuilder();
  set salesSettings(SalesSettingsBuilder? salesSettings) =>
      _$this._salesSettings = salesSettings;

  ContextBranchBuilder() {
    ContextBranch._defaults(this);
  }

  ContextBranchBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _voidReasons = $v.voidReasons?.toBuilder();
      _salesSettings = $v.salesSettings?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ContextBranch other) {
    _$v = other as _$ContextBranch;
  }

  @override
  void update(void Function(ContextBranchBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ContextBranch build() => _build();

  _$ContextBranch _build() {
    _$ContextBranch _$result;
    try {
      _$result = _$v ??
          _$ContextBranch._(
            id: BuiltValueNullFieldError.checkNotNull(
                id, r'ContextBranch', 'id'),
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'ContextBranch', 'name'),
            voidReasons: _voidReasons?.build(),
            salesSettings: _salesSettings?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'voidReasons';
        _voidReasons?.build();
        _$failedField = 'salesSettings';
        _salesSettings?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'ContextBranch', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
