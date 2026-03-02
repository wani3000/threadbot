insert into public.sources(name, url, enabled)
values
  ('koreanair-recruit', 'https://koreanair.recruiter.co.kr/career/apply', true),
  ('asiana-recruit', 'https://flyasiana.recruiter.co.kr/career/recruitment', true),
  ('naver-jjooo112', 'https://blog.naver.com/jjooo112', true),
  ('naver-olive2269', 'https://blog.naver.com/olive2269', true),
  ('naver-bongbongb0ng', 'https://blog.naver.com/bongbongb0ng', true),
  ('naver-on-fly', 'https://blog.naver.com/on_fly', true),
  ('instagram-crewfactory-jh', 'https://www.instagram.com/crewfactory.hc_jh/', true),
  ('threads-ije-writer', 'https://www.threads.com/@ije_writer', true),
  ('instagram-crewfactory-sunny', 'https://www.instagram.com/crewfactory.hc_sunny/', true),
  ('instagram-koreanair', 'https://www.instagram.com/koreanair/', true),
  ('instagram-wingsky', 'https://www.instagram.com/wingsky_official/', true),
  ('instagram-on-fly', 'https://www.instagram.com/on___fly/', true),
  ('facebook-wingskygj', 'https://www.facebook.com/wingskygj', true),
  ('naver-anacast', 'https://blog.naver.com/anacast', true)
on conflict (url) do nothing;
