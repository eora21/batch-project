# 프로젝트 실행 방법 (설치, 실행 명령어)

# API 사용법 (엔드포인트별 요청/응답 예시)

# 구현 관련 상세 설명 및 코멘트

## API 디자인 및 서빙 전략

### 왜 응답용 DTO를 쓰지 않았는가?

감춰야 할 데이터가 있거나 통일된 데이터 형태를 맞춰줘야 하는 경우에는, 응답 시 DTO를 사용하곤 합니다.

이번 과제에서는 Job 자체를 JSON 형태로 저장하는 형식이었기 때문에, DTO를 사용하지 않았습니다.

이는 데이터를 그대로 보여줘야 한다는 단점이 있으므로, 추후 형태가 확장될 수 있는 경우 DTO를 사용해야 할 것입니다.

## 데이터 처리 전략

### UUID v7을 사용한 이유는?

UUID v1, v2, v6, v7은 TimeStamp를 사용합니다.

v1, v2, v6는 MAC 주소를 기반으로 생성되며, v1과 v2는 시간 순으로 정렬하지 않습니다. 반면 v6와 v7은 시간순으로 정렬이 가능합니다.

v7은 생성 과정에서 MAC 주소를 사용하지 않으며, 시간순으로 정렬이 가능합니다.

따라서 매 요청마다 랜덤한 값을 만들면서도, 생성 환경에 영향을 받지 않고, 생성 시간을 유추할 수 있으며, 생성 시간 순으로 정렬이 가능한 v7을 선택하였습니다.

## 성능 관리 전략

### 인덱스 전략을 사용하려면 어떻게 해야 할까?

다음의 작업들은 인덱스가 존재하는 경우 굉장히 빨라질 수 있습니다.

- 1분마다 status 변경하는 배치 구현
- id로 데이터 조회
- title로 데이터 조회
- status로 데이터 조회

우선 `node-json-db`가 어떻게 데이터를 다루는 지 확인해봐야 합니다. 데이터 조회 시 '빠른 속도'를 위해, 특별한 작업을 하고 있을까요?

아쉽게도, 그렇지 않았습니다.

```
public getObject<T>(dataPath: string): Promise<T> {
    return this.getData(dataPath)
}
```

```
public getData(dataPath: string): Promise<any> {
    return readLockAsync(async () => {
        const path = this.processDataPath(dataPath) // 맨 앞뒤 구분자 자르기
        return this.retrieveData(path, false)
    });
}
```

```
private async retrieveData(dataPath: DataPath, create: boolean = false): Promise<any> {
    await this.load()

    const thisDb = this

    const recursiveProcessDataPath = (data: any, index: number): any => {
        let property = dataPath[index]

        /**
         * Find the wanted Data or create it.
         */
        function findData(isArray: boolean = false) {
            if (data.hasOwnProperty(property)) {
                data = data[property]
            } else if (create) {
                if (isArray) {
                    data[property] = []
                } else {
                    data[property] = {}
                }
                data = data[property]
            } else {
                throw new DataError(
                    `Can't find dataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. Stopped at ${property}`,
                    5
                )
            }
        }

        const arrayInfo = ArrayInfo.processArray(property)
        if (arrayInfo) {
            property = arrayInfo.property
            findData(true)
            if (!Array.isArray(data)) {
                throw new DataError(
                    `DataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. ${property} is not an array.`,
                    11
                )
            }
            const arrayIndex = arrayInfo.getIndex(data, true)
            if (!arrayInfo.append && data.hasOwnProperty(arrayIndex)) {
                data = arrayInfo.getData(data)
            } else if (create) {
                if (arrayInfo.append) {
                    data.push({})
                    data = data[data.length - 1]
                } else {
                    data[arrayIndex] = {}
                    data = data[arrayIndex]
                }
            } else {
                throw new DataError(
                    `DataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. . Can't find index ${arrayInfo.index} in array ${property}`,
                    10
                )
            }
        } else {
            findData()
        }

        if (dataPath.length == ++index) {
            // check data
            return data
        }
        return recursiveProcessDataPath(data, index)
    }

    if (dataPath.length === 0) {
        return this.data
    }

    return recursiveProcessDataPath(this.data, 0)
}
```

```
public async load(): Promise<void> {
    if (this.loaded) {
        return
    }
    try {
        this.data = await this.config.adapter.readAsync();
        this.loaded = true
    } catch (err) {
        throw new DatabaseError("Can't Load Database", 1, err)
    }
}
```

```
async readAsync(): Promise<any> {
    const data = await this.adapter.readAsync(); // fileAsync 사용
    if (data == null || data === '') {
        await this.writeAsync({});
        return {};
    }
    return JSON.parse(data, this.reviver.bind(this));
}
```

```
import {readFile, open, FileHandle, mkdir} from "fs/promises";

async readAsync(): Promise<string | null> {
    try {
        return await readFile(this.filename, {
            encoding: 'utf-8'
        })
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw e
    }
}
```

```
private readonly dateRegex = new RegExp('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', 'm') // YYYY-MM-DDTHH:mm:ss

private reviver(key: string, value: any): any {
    if (typeof value == "string" && this.dateRegex.exec(value) != null) {
        return new Date(value);
    }
    return value;
}
```

즉, 특별한 과정 없이 '메모리에 올린 데이터'를 읽어오는 것으로 파악되었습니다.

만약 데이터가 굉장히 많은 경우, 메모리에 적재하는 데 굉장히 오래 걸릴 것입니다.

이는 매우 당연하게도, Json을 통해 데이터 저장 및 획득이 약속되어 있는 라이브러리이기 때문입니다.

만약 'pc의 메모리 용량을 초과할 정도로 많은 데이터'를 가져온다면 어떻게 될까요?

가상 메모리 용량이 0이라고 가정하는 경우, 프로세스는 죽어버리고 말 것입니다.

대용량 데이터 및 인덱스 사용을 위해서는 따로 DB를 사용하거나, node-json-db를 통해 실제 DB의 동작을 흉내낼 수 있어야 합니다.

과제 조건에서는 무조건 node-json-db를 사용하도록 작성되어 있습니다.

~~따라서 인덱스 기법을 활용하기 위해선 node-json-db를 이용하되, 실제 대용량 DB처럼 동작하도록 설계해야 할 것입니다.~~

node-json-db는 파일 전체를 메모리에 올릴 뿐 부분적인 파일을 읽어오지 못 하며, `작업 데이터는 jobs.json 파일에 저장`하도록 되어 있습니다.

즉 작업 데이터들의 일부를 jobs.json에 작성하고, 인덱싱 등의 작업을 위한 추가적인 데이터들을 다른 파일에 작성한다면 요구사항에 벗어나는 설계가 됩니다.

또한, '모든 파일 내용을 메모리에 적재'하는 node-json-db의 근본적인 한계는 벗어날 수 없습니다.

## 기타 구현 디테일

### `Repository`에서 `NotFoundException`을 사용하는 게 옳을까?

`NotFoundException`은 `HttpException`을 상속받은 예외입니다. 즉, 이미 `Repository`에서 `Http`로 예외가 반환됨을 알고 있는 형태입니다.

원칙적으로 `Repository`는 상위 레이어인 `Controller` 관련 구성을 몰라야 하므로, 해당 예외는 어디까지나 'DB에 데이터가 없음'을 알려야 합니다.

빠른 개발을 위해 임시로 사용하도록 하며, 추후 `filter` 작업으로 개선해 볼 예정입니다.
---

# 개발 체크포인트

- [x] NestJS 초기화
- [x] 데이터 저장소 설정
- [x] 작업 생성 API 작성
    - [x] jobs 객체 반환
    - [x] title, description 필수 유효성 추가
- [x] 특정 작업 상세 정보 조회 API 작성
    - [x] jobs 객체 반환
    - [x] 작업이 존재하지 않으면 404
- [x] 모든 작업 목록 조회 API 작성
    - [x] jobs 객체 리스트 반환
- [x] 작업 검색 API 작성
    - [x] 상태나 제목으로 작업 검색
    - [x] jobs 객체 리스트 반환
- [x] 매 1분마다 배치 구현
    - [x] `pending` 상태 작업을 `completed`로 업데이트
    - [x] 상태 변경 시 콘솔 또는 파일(logs.txt)에 로그 기록
- [ ] 성능 및 오류 처리
    - [ ] API 응답 시간 최대한 빠르게
    - [ ] 동시 요청 시 데이터 무결성 보장
    - [ ] 적절한 오류 처리(유효하지 않은 요청 400, 찾을 수 없는 리소스 404 등)
- [ ] `filter` 생성 및 `Repository`에서 `NotFoundException` 사용한 내용 수정
- [ ] `jobs.json`에 샘플 데이터 셋팅
- [ ] 기본 노드 환경에서 실행되도록 세팅
