// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reservation_period.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ReservationPeriod extends ReservationPeriod {
  @override
  final String start;
  @override
  final String end;

  factory _$ReservationPeriod(
          [void Function(ReservationPeriodBuilder)? updates]) =>
      (ReservationPeriodBuilder()..update(updates))._build();

  _$ReservationPeriod._({required this.start, required this.end}) : super._();
  @override
  ReservationPeriod rebuild(void Function(ReservationPeriodBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  ReservationPeriodBuilder toBuilder() =>
      ReservationPeriodBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ReservationPeriod &&
        start == other.start &&
        end == other.end;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, start.hashCode);
    _$hash = $jc(_$hash, end.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ReservationPeriod')
          ..add('start', start)
          ..add('end', end))
        .toString();
  }
}

class ReservationPeriodBuilder
    implements Builder<ReservationPeriod, ReservationPeriodBuilder> {
  _$ReservationPeriod? _$v;

  String? _start;
  String? get start => _$this._start;
  set start(String? start) => _$this._start = start;

  String? _end;
  String? get end => _$this._end;
  set end(String? end) => _$this._end = end;

  ReservationPeriodBuilder() {
    ReservationPeriod._defaults(this);
  }

  ReservationPeriodBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _start = $v.start;
      _end = $v.end;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ReservationPeriod other) {
    _$v = other as _$ReservationPeriod;
  }

  @override
  void update(void Function(ReservationPeriodBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ReservationPeriod build() => _build();

  _$ReservationPeriod _build() {
    final _$result = _$v ??
        _$ReservationPeriod._(
          start: BuiltValueNullFieldError.checkNotNull(
              start, r'ReservationPeriod', 'start'),
          end: BuiltValueNullFieldError.checkNotNull(
              end, r'ReservationPeriod', 'end'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
